import type { FournisseurSms } from "./types";
import { fournisseurConsole } from "./console";
import { fournisseurSmsPro } from "./smspro";
import { fournisseurTwilio } from "./twilio";

// Choix du fournisseur par la variable SMS_FOURNISSEUR :
// "console" (test, défaut), "smspro" ou "twilio".
export function fournisseurSms(): FournisseurSms {
  const choix = (process.env.SMS_FOURNISSEUR ?? "console").toLowerCase();
  if (choix === "smspro") return fournisseurSmsPro;
  if (choix === "twilio") return fournisseurTwilio;
  return fournisseurConsole;
}
