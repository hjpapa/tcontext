// Minimal typings for the parts of fengari (a Lua VM in JavaScript) that the
// rate-limit tests use to run the Redis script. Test-only dependency.
declare module "fengari" {
  type LuaState = { readonly __luaState: unique symbol };
  type LuaString = Uint8Array;

  export const lua: {
    LUA_OK: number;
    LUA_TNUMBER: number;
    LUA_TSTRING: number;
    lua_createtable(L: LuaState, narr: number, nrec: number): void;
    lua_gettop(L: LuaState): number;
    lua_pcall(
      L: LuaState,
      nargs: number,
      nresults: number,
      msgh: number,
    ): number;
    lua_pop(L: LuaState, n: number): void;
    lua_pushcfunction(L: LuaState, fn: (L: LuaState) => number): void;
    lua_pushinteger(L: LuaState, n: number): void;
    lua_pushstring(L: LuaState, s: LuaString): void;
    lua_rawgeti(L: LuaState, index: number, n: number): number;
    lua_rawlen(L: LuaState, index: number): number;
    lua_rawseti(L: LuaState, index: number, n: number): void;
    lua_setfield(L: LuaState, index: number, key: LuaString): void;
    lua_setglobal(L: LuaState, name: LuaString): void;
    lua_tojsstring(L: LuaState, index: number): string;
    lua_tonumber(L: LuaState, index: number): number;
    lua_type(L: LuaState, index: number): number;
  };
  export const lauxlib: {
    luaL_error(L: LuaState, message: LuaString): never;
    luaL_loadstring(L: LuaState, source: LuaString): number;
    luaL_newstate(): LuaState;
  };
  export const lualib: {
    luaL_openlibs(L: LuaState): void;
  };
  export function to_luastring(value: string): LuaString;
}
