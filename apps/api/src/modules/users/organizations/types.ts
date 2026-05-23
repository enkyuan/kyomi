export type OrganizationMembershipDto = {
  membershipId: string;
  organizationId: string;
  organizationName: string;
  plan: string;
  role: string;
};

export type UserMembershipsResponseDto = {
  items: OrganizationMembershipDto[];
};
