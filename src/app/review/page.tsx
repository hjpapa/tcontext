import { ProfileReview } from "@/components/profile/profile-review";

export default function ReviewPage() {
  return (
    <div className="page-container py-8 sm:py-12 lg:py-16">
      <div className="page-workspace">
        <ProfileReview />
      </div>
    </div>
  );
}
