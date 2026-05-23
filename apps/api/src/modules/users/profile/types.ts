/** Public user profile for `GET /api/v1/users/profile` (no secrets). */
export type UserProfileDto = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
  updatedAt: string;
};
