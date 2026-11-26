import transporter from "../config/mail.config.js";
import { renderTemplate } from "../utils/renderTemplate.js";


export const sendMail = async ({
  to,
  subject,
  templateName,
  data = {},
  attachments = [],
}) => {
  const html = await renderTemplate(templateName, data);

  const info = await transporter.sendMail({
    from: `"${process.env.MAIL_FROM_NAME || "Price First"}" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
    attachments,
  });

  return info;
};