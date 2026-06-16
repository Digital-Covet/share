import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

export const statement = {
	...defaultStatements,
} as const;

export const ac = createAccessControl(statement);

export const superadminRole = ac.newRole({
	...adminAc.statements,
	user: [
		"impersonate-admins",

		...adminAc.statements.user,
	],
});

export const adminRole = ac.newRole({
	...adminAc.statements,
});

export const employeeRole = ac.newRole({
	user: [],
	session: [],
});
