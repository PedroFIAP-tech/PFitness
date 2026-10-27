"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-rules";
import { signIn, signUp } from "../actions";
import { FormMessage } from "./form-message";

type Mode = "entrar" | "cadastro";

const MODES = [
  { value: "entrar", label: "Entrar" },
  { value: "cadastro", label: "Criar conta" },
] as const;

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("entrar");
  // Controlados para sobreviver à troca de modo e ao reset do form após a action
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [signInState, signInAction, signingIn] = useActionState(signIn, undefined);
  const [signUpState, signUpAction, signingUp] = useActionState(signUp, undefined);

  const isSignUp = mode === "cadastro";
  const state = isSignUp ? signUpState : signInState;
  const pending = isSignUp ? signingUp : signingIn;

  return (
    <Card className="flex flex-col gap-5">
      <Segmented aria-label="Tipo de acesso" options={MODES} value={mode} onChange={setMode} />

      <form action={isSignUp ? signUpAction : signInAction} className="flex flex-col gap-4">
        {isSignUp && (
          <Field label="Nome" htmlFor="name">
            <Input
              id="name"
              name="name"
              autoComplete="name"
              placeholder="Como quer ser chamado"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
        )}

        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            placeholder="voce@email.com"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Field label="Senha" htmlFor="password">
          <Input
            key={mode}
            id="password"
            name="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            minLength={isSignUp ? MIN_PASSWORD_LENGTH : undefined}
            placeholder={isSignUp ? `Mínimo de ${MIN_PASSWORD_LENGTH} caracteres` : "Sua senha"}
            required
          />
        </Field>

        {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}
        {state?.notice && <FormMessage tone="success">{state.notice}</FormMessage>}

        <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
          {isSignUp ? "Criar conta" : "Entrar"}
        </Button>
      </form>
    </Card>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
