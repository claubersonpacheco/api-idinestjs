export type AuthenticatedUser = {
  sub: number;
  email: string;
  name: string;
  role: {
    id: number;
    name: string;
    permissions: {
      id: number;
      name: string;
    }[];
  } | null;
};
