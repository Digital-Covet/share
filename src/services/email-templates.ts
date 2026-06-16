import { COMPANY_NAME, SUPPORT_EMAIL } from "@/lib/constants";

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}
interface InviteEmailParams {
	username: string;
	inviteUrl: string;
}
export function renderInviteEmail({ username, inviteUrl }: InviteEmailParams): {
	html: string;
	text: string;
} {
	const safeUsername = escapeHtml(username);
	const htmlContent = `
    <div style="border: solid 1px #E5E5E5;border-radius: 5px;margin:0px auto; max-width:600px;width:600px;background:#fff;font-family: Lato, Helvetica, 'Helvetica Neue', Arial, 'sans-serif';">
      <table cellspacing="0" cellpadding="0" style="width: 100%;font-size: 14px;"><tbody><tr><td style="padding:32px">
        <div><h1 style="margin: 0 0 32px;font-size:20px;text-align:center">Welcome to ${COMPANY_NAME}!<br></h1></div>
        <div style="background: #fff;border-radius: 10px;overflow: hidden;border: solid 1px #E5E5E5;border-radius: 10px;">
          <table cellspacing="0" cellpadding="0" style="width:100%;font-size: 14px;"><tbody><tr><td><div style="padding: 32px 24px;text-align: center;">
            <p style="margin: 0px 0px 20px; line-height: 1.6;">
              <span style="font-size: 14px; margin: 0px 0px 20px; line-height: 1.6;">Hello ${safeUsername}! We are very glad that you have joined ${COMPANY_NAME}. Click on the below link to set up your password and get started.</span><br>
            </p>
            <div style="margin-top: 24px;margin-bottom: 32px">
              <a href="${inviteUrl}" style="color: #fff;text-decoration: none;margin: 0 auto;background-color: #274ded;display: table;padding: 8px 16px;">Set Up Password</a><br>
            </div>
            <p style="line-height: 1.6; margin: 24px 0px 0px;">
              <span style="font-size: 14px; line-height: 1.6; margin: 24px 0px 0px;">If you have further questions, write to us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#006CFF;text-decoration: none;">${SUPPORT_EMAIL}</a> and our team will get back to you.</span><br>
            </p>
            <div style="margin-top: 32px;line-height: 1.6;"><p style="margin: 0px;"><span style="font-size: 13px; margin: 0px;">Have a great day!</span><br></p></div>
          </div></td></tr></tbody></table>
        </div>
      </td></tr></tbody></table>
    </div><div><br></div>`;
	const textContent = `Welcome to ${COMPANY_NAME}!
Hello ${safeUsername}!
We are very glad that you have joined ${COMPANY_NAME}. Click the link below to set up your password:
 ${inviteUrl}
If you have further questions, write to us at ${SUPPORT_EMAIL}
Have a great day!`;
	return { html: htmlContent, text: textContent };
}

interface DeleteVerificationEmailParams {
	username: string;
	otp: string;
}
export function renderDeleteVerificationEmail({
	username,
	otp,
}: DeleteVerificationEmailParams): {
	html: string;
	text: string;
} {
	const safeUsername = escapeHtml(username);
	const safeOtp = escapeHtml(otp);
	const htmlContent = `
    <div style="border: solid 1px #E5E5E5;border-radius: 5px;margin:0px auto; max-width:600px;width:600px;background:#fff;font-family: Lato, Helvetica, 'Helvetica Neue', Arial, 'sans-serif';">
      <table cellspacing="0" cellpadding="0" style="width: 100%;font-size: 14px;"><tbody><tr><td style="padding:32px">
        <div><h1 style="margin: 0 0 32px;font-size:20px;text-align:center">Verify Your Action<br></h1></div>
        <div style="background: #fff;border-radius: 10px;overflow: hidden;border: solid 1px #E5E5E5;border-radius: 10px;">
          <table cellspacing="0" cellpadding="0" style="width:100%;font-size: 14px;"><tbody><tr><td><div style="padding: 32px 24px;text-align: center;">
            <p style="margin: 0px 0px 20px; line-height: 1.6;">
              <span style="font-size: 14px; margin: 0px 0px 20px; line-height: 1.6;">Hello ${safeUsername}, you are about to perform a sensitive action that requires verification. Please use the following code to confirm your identity:</span><br>
            </p>
            <div style="margin-top: 24px;margin-bottom: 32px;padding: 16px;background-color: #f5f5f5;border-radius: 8px;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #274ded;">${safeOtp}</span><br>
            </div>
            <p style="line-height: 1.6; margin: 24px 0px 0px;">
              <span style="font-size: 14px; line-height: 1.6; margin: 24px 0px 0px;">This code expires in 5 minutes. If you did not request this, please ignore this email and contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#006CFF;text-decoration: none;">${SUPPORT_EMAIL}</a>.</span><br>
            </p>
            <div style="margin-top: 32px;line-height: 1.6;"><p style="margin: 0px;"><span style="font-size: 13px; margin: 0px;">Have a great day!</span><br></p></div>
          </div></td></tr></tbody></table>
        </div>
      </td></tr></tbody></table>
    </div><div><br></div>`;
	const textContent = `Verify Your Action
Hello ${safeUsername},
You are about to perform a sensitive action that requires verification. Please use the following code to confirm your identity:
 ${otp}
This code expires in 5 minutes. If you did not request this, please ignore this email and contact us at ${SUPPORT_EMAIL}.
Have a great day!`;
	return { html: htmlContent, text: textContent };
}
