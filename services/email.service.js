const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.MAILTRAP_HOST,
    port: Number(process.env.MAILTRAP_PORT),
    auth: {
        user: process.env.MAILTRAP_USER,
        pass: process.env.MAILTRAP_PASS
    }
});

const sendEmail = async ({ to, subject, html }) => {
    const mail = await transporter.sendMail({
        from: "CHOWNOW <noreply@chownow.test>",
        to,
        subject,
        html
    });

    return mail;
};

module.exports = sendEmail;