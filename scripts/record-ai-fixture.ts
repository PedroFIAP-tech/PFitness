// Grava a resposta REAL da IA para o texto de exemplo em
// lib/ai/fixtures/workout-import-example.ts (usada pelo AI_PROVIDER=mock).
// Chama a API da OpenAI e gasta créditos: rode só quando o prompt ou o schema mudarem.
//
//   npm run ai:record-fixture
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { createOpenAIProvider, OPENAI_DEFAULT_MODEL, OPENAI_DEFAULT_REASONING_EFFORT } from "@/lib/ai/openai";
import { ParsedWorkoutSchema, workoutImportInstructions } from "@/lib/ai/workout-schema";

const root = new URL("..", import.meta.url);
const text = readFileSync(new URL("lib/ai/fixtures/workout-import-example.txt", root), "utf8");
const apiKey = process.env.OPENAI_API_KEY?.trim();
if (!apiKey) throw new Error("OPENAI_API_KEY ausente (.env.local)");

// Vocabulário do prompt: a biblioteca global (o RLS deixa o anon ler)
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const { data: library, error } = await supabase.from("exercises").select("name, equipment").is("user_id", null);
if (error) throw error;

const model = process.env.AI_MODEL?.trim() || OPENAI_DEFAULT_MODEL;
const reasoningEffort = process.env.AI_REASONING_EFFORT?.trim() || OPENAI_DEFAULT_REASONING_EFFORT;
const started = Date.now();
const raw = await createOpenAIProvider(apiKey, model, reasoningEffort).generate({
  instructions: workoutImportInstructions(library),
  input: `TEXTO DO TREINO:\n"""\n${text}\n"""`,
  schema: ParsedWorkoutSchema,
  schemaName: "fichas_de_treino",
});
const output = ParsedWorkoutSchema.parse(raw);

const fixture = { model, reasoningEffort, recordedAt: new Date().toISOString(), output };
writeFileSync(
  new URL("lib/ai/fixtures/workout-import-example.ts", root),
  `// Gerado por scripts/record-ai-fixture.ts a partir de workout-import-example.txt. Não edite à mão.\n` +
    `export const WORKOUT_IMPORT_FIXTURE = ${JSON.stringify(fixture, null, 2)};\n`,
);
console.log(
  `Fixture gravada em ${((Date.now() - started) / 1000).toFixed(1)} s: ` +
    `${output.fichas.length} fichas, ${output.fichas.flatMap((plan) => plan.exercicios).length} exercícios (${model}, raciocínio ${reasoningEffort}).`,
);
