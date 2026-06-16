import type { UserRole as PrismaUserRole } from "@generated/auth/client";

export type UserRole = PrismaUserRole;

export interface AuthUser {
	id: string;
	email: string;
	name: string;
	role: UserRole;
	departmentId: string | null;
	emailVerified: boolean;
	twoFactorEnabled: boolean;

	passwordChanged: boolean;
	image: string | null;
}
