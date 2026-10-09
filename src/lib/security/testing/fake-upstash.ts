import { lauxlib, lua, lualib, to_luastring } from "fengari";

type SortedSet = Map<string, number>;

/**
 * An Upstash REST endpoint for tests. It runs the real EVAL script in a Lua
 * VM against an in-memory emulation of the sorted-set commands it uses, so
 * the script itself is exercised, not a JavaScript copy of it.
 */
export function createFakeUpstash(token: string) {
  const sets = new Map<string, SortedSet>();
  const expiresAt = new Map<string, number>();
  const ttlMs = new Map<string, number>();
  const bodies: string[] = [];
  let failure: (() => Promise<Response>) | undefined;

  const expire = (clock: number) => {
    for (const [key, at] of expiresAt) {
      if (at <= clock) {
        sets.delete(key);
        expiresAt.delete(key);
      }
    }
  };

  const ordered = (set: SortedSet) =>
    [...set.entries()].sort(
      ([leftMember, left], [rightMember, right]) =>
        left - right || leftMember.localeCompare(rightMember),
    );

  const command = (args: string[], clock: number): number | string[] => {
    const [name = "", key = "", ...rest] = args;
    const set = sets.get(key) ?? new Map<string, number>();
    switch (name.toUpperCase()) {
      case "ZREMRANGEBYSCORE": {
        const max = Number(rest[1]);
        let removed = 0;
        for (const [member, score] of set) {
          if (score <= max) {
            set.delete(member);
            removed += 1;
          }
        }
        if (set.size === 0) sets.delete(key);
        return removed;
      }
      case "ZCARD":
        return set.size;
      case "ZRANGE": {
        const start = Number(rest[0]);
        const stop = Number(rest[1]);
        return ordered(set)
          .slice(start, stop + 1)
          .flatMap(([member, score]) => [member, String(score)]);
      }
      case "ZADD": {
        const isNew = !set.has(rest[1] ?? "");
        set.set(rest[1] ?? "", Number(rest[0]));
        sets.set(key, set);
        return isNew ? 1 : 0;
      }
      case "PEXPIRE": {
        if (!sets.has(key)) return 0;
        expiresAt.set(key, clock + Number(rest[0]));
        ttlMs.set(key, Number(rest[0]));
        return 1;
      }
      default:
        throw new Error(`unsupported command ${name}`);
    }
  };

  const evaluate = (script: string, keys: string[], argv: string[]) => {
    const clock = Number(argv[0]);
    expire(clock);
    const L = lauxlib.luaL_newstate();
    lualib.luaL_openlibs(L);

    for (const [name, values] of [
      ["KEYS", keys],
      ["ARGV", argv],
    ] as const) {
      lua.lua_createtable(L, values.length, 0);
      values.forEach((value, index) => {
        lua.lua_pushstring(L, to_luastring(value));
        lua.lua_rawseti(L, -2, index + 1);
      });
      lua.lua_setglobal(L, to_luastring(name));
    }

    lua.lua_createtable(L, 0, 1);
    lua.lua_pushcfunction(L, (state) => {
      const args: string[] = [];
      for (let index = 1; index <= lua.lua_gettop(state); index += 1) {
        // Redis turns Lua numbers into integer strings for commands.
        args.push(
          lua.lua_type(state, index) === lua.LUA_TNUMBER
            ? String(Math.trunc(lua.lua_tonumber(state, index)))
            : lua.lua_tojsstring(state, index),
        );
      }
      let reply: number | string[];
      try {
        reply = command(args, clock);
      } catch (error) {
        return lauxlib.luaL_error(state, to_luastring(String(error)));
      }
      if (typeof reply === "number") {
        lua.lua_pushinteger(state, reply);
      } else {
        lua.lua_createtable(state, reply.length, 0);
        reply.forEach((value, index) => {
          lua.lua_pushstring(state, to_luastring(value));
          lua.lua_rawseti(state, -2, index + 1);
        });
      }
      return 1;
    });
    lua.lua_setfield(L, -2, to_luastring("call"));
    lua.lua_setglobal(L, to_luastring("redis"));

    if (
      lauxlib.luaL_loadstring(L, to_luastring(script)) !== lua.LUA_OK ||
      lua.lua_pcall(L, 0, 1, 0) !== lua.LUA_OK
    ) {
      throw new Error(lua.lua_tojsstring(L, -1));
    }
    // Redis turns a returned Lua array of numbers into integer replies.
    const result: number[] = [];
    for (let index = 1; index <= lua.lua_rawlen(L, -1); index += 1) {
      lua.lua_rawgeti(L, -1, index);
      result.push(Math.trunc(lua.lua_tonumber(L, -1)));
      lua.lua_pop(L, 1);
    }
    return result;
  };

  const fetch = async (
    _input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const body = String(init?.body ?? "");
    bodies.push(body);
    if (failure) return failure();
    const authorization = new Headers(init?.headers).get("authorization");
    if (authorization !== `Bearer ${token}`) {
      return Response.json({ error: "WRONGPASS" }, { status: 401 });
    }
    const [name, script, keyCount, ...rest] = JSON.parse(body) as string[];
    if (name !== "EVAL" || !script) {
      return Response.json({ error: "unsupported" }, { status: 400 });
    }
    try {
      const count = Number(keyCount);
      const result = evaluate(script, rest.slice(0, count), rest.slice(count));
      return Response.json({ result });
    } catch (error) {
      return Response.json({ error: String(error) }, { status: 400 });
    }
  };

  return {
    fetch,
    /** Every request body sent to the store, as raw text. */
    bodies,
    keys: () => [...sets.keys()],
    members: () => [...sets.values()].flatMap((set) => [...set.keys()]),
    ttlMs,
    fail(next: (() => Promise<Response>) | undefined) {
      failure = next;
    },
  };
}
