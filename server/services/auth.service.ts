import { AppError } from "@shared/errors/app-error.js";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import {
  changePasswordTransaction,
  type DbClient,
  findCredentialAccount,
} from "../repositories/auth.repository.js";

export async function changePassword(
  prisma: DbClient,
  userId: string,
  oldPassword: string,
  newPassword: string
) {
  if (oldPassword === newPassword) {
    throw new AppError("PASSWORD_SAME_AS_OLD");
  }

  const account = await findCredentialAccount(prisma, userId);
  if (!account?.password) {
    throw new AppError("NO_PASSWORD_SET");
  }

  const isValid = await verifyPassword({
    hash: account.password,
    password: oldPassword,
  });
  if (!isValid) {
    throw new AppError("CURRENT_PASSWORD_INCORRECT");
  }

  const hashedNewPassword = await hashPassword(newPassword);

  await changePasswordTransaction(prisma, userId, hashedNewPassword);

  return { success: true };
}
