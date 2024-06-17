"use server";

import * as z from "zod";
import { AuthError } from "next-auth";

import { LoginSchema } from "@/schemas";
import { signIn } from "@/auth";
import { DEFAULT_LOGIN_REDIRECT } from "@/routes";
import {
  generateVerificationToken,
  generateTwoFactorToken,
} from "@/lib/tokens";
import { getUserByEmail } from "@/data/user";
import { sendVerificationEmail, sendTwoFactorEmail } from "@/lib/mail";

export const login = async (values: z.infer<typeof LoginSchema>) => {
  const validatedFields = LoginSchema.safeParse(values);

  if (!validatedFields.success) {
    return { error: "invalid fields!" };
  }

  const { email, password } = validatedFields.data;
  const existingUser = await getUserByEmail(email);

  if (!existingUser || !existingUser?.email || !existingUser?.password) {
    return { error: "Email does not exist!" };
  }

  if (!existingUser?.emailVerified) {
    const verificationToken = await generateVerificationToken(
      existingUser?.email
    );
    await sendVerificationEmail(
      verificationToken?.email,
      verificationToken?.token
    );
    return { success: "Confirmation email sent!" };
  }

  if (existingUser?.isTwoFactorEnabled && existingUser?.email) {
    console.log("masuk sini");
    const twoFactorToken = await generateTwoFactorToken(email);
    await sendTwoFactorEmail(twoFactorToken?.email, twoFactorToken?.token);

    return { twoFactor: true };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: DEFAULT_LOGIN_REDIRECT,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "invalid credentials!" };
        default:
          return { error: "Something went wrong!" };
      }
    }

    throw error;
  }
};
