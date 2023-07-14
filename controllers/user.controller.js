import _ from "lodash";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { transporter, mailGenerator } from "../config/mailer.config.js";
import userService from "../services/user.service.js";
import UserModel from "../models/user.model.js";

class UserController {
  async createUser(req, res) {

    const data = {
      email: req.body.email.toLowerCase(),
      password: bcrypt.hashSync(req.body.password, 10),
      lastname: req.body.lastname,
      firstname: req.body.firstname
    };
    for (const property in data) {
      if (!data[property]) {
        return res.status(400).send({
          success: false,
          message: `The ${property} field is required`
        });
      }
    }
    const user = await userService.findByEmail(req.body);
    if (!_.isEmpty(user)) {
      return res.status(400).send({
        success: false,
        message: "User already exists"
      });
    }

    const newUser = await userService.create(data);

    const verificationToken = newUser.generateToken();
    const url = `${process.env.APP_URL}/users/verify/${verificationToken}`;

    const response = {
      body: {
        name: `${data.lastname}`,
        intro: "Email Verification Link",
        action: {
          instructions:
            "If you did not request for this mail, Please Ignore it. To Verify your Email password, click on the link below:",
          button: {
            text: "Verify Email",
            link: url
          }
        },
        outro: "Do not share this link with anyone."
      }
    };

    const mail = mailGenerator.generate(response);

    const message = {
      from: "E-Commerce <enere0115@gmail.com>",
      to: req.body.email,
      subject: "Verify Your Email",
      html: mail
    };

    await transporter.sendMail(message);

    return res.status(201).send({
      message: `Sent a verification email to ${data.email}`
    });
  }

  async loginUser(req, res) {
    const user = await UserModel.findOne({ email: req.body.email });
    if (_.isEmpty(user)) {
      return res.status(404).send({
        success: false,
        message: "user does not exist, create a user before attempting to login"
      });
    }
    const verifyPassword = bcrypt.compareSync(req.body.password, user.password);
    if (!verifyPassword) {
      return res.status(404).send({
        success: false,
        message: "email or password is invalid"
      });
    }
    const token = jwt.sign(
      { _id: user._id, username: user.username },
      process.env.TOKEN_SECRET,
      { expiresIn: "20h", algorithm: "HS512" }
    );
    return res.status(200).send({
      success: true,
      body: {
        message: "user logged in successfully",
        token,
        data: user
      }
    });
  }

  async verify(req, res) {
    const { token } = req.params;
    // Check we have an id
    if (!token) {
      return res.status(422).send({
        message: "Missing Token"
      });
    }

    const decoded = jwt.verify(token, process.env.TOKEN_SECRET);
    const user = await userService.findOne({ _id: decoded._id });
    if (!user) {
      return res.status(404).send({
        message: "User does not  exist"
      });
    }

    user.verified = true;
    await user.save();

    return res.status(200).send({
      message: "Account Verified"
    });
  }

  async getUsers(req, res) {
    try {
      const user = await userService.find();
      return res.status(200).send({
        success: true,
        data: user
      });
    } catch (err) {
      console.log(err);
      return res.status(400).send({
        success: false,
        error: err.message
      });
    }
  }

  async forgotPassword(req, res) {
    const { newPassword } = req.body;

    const user = await userService.findByEmail(req.body);
    if (_.isEmpty(user)) {
      return res.status(404).send({
        success: false,
        message: "user does not exist"
      });
    }
    if (user) {
      const hash = bcrypt.hashSync(newPassword, 10);

      await user.updateOne({ password: hash });
    }

    const response = {
      body: {
        name: `${user.username}`,
        intro: "Password Reset Successfully.",
        outre:
          "If you did not initiate this reset please contact our customer support."
      }
    };

    const mail = mailGenerator.generate(response);

    const message = {
      from: "Across the Globe <enere0115@gmail.com>",
      to: user.email,
      subject: "Password reset success",
      html: mail
    };

    await transporter.sendMail(message);

    return res.status(201).send({
      message: `Password changed successfully. Confirmation email sent to  ${user.email}`
    });
  }

  async delete(req, res) {
    try {
      await userService.delete(req.body.id);
      return res.status(201).send({
        success: true,
        message: "User deleted successfully"
      });
    } catch (err) {
      console.log(err);
      return res.status(404).send({
        message: "deletion failed",
        error: err.message
      });
    }
  }
}

export default new UserController();
