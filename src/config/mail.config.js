import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export const verifyMailConnection = async () => {
  try {
    await transporter.verify();
    console.log("Gmail SMTP ready");
  } catch (error) {
    console.error("Gmail SMTP connection failed:", error.message);
  }
};

export default transporter;