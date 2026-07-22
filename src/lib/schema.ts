import { z } from "zod";

export const projectFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  status: z.enum(["idea", "in_progress"]),
  repo_url: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^https?:\/\//.test(v), "Repo URL must start with http:// or https://"),
  local_path: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

/** Soft warning (not a blocking validation error) per spec §3.5. */
export function needsActivitySourceWarning(values: Pick<ProjectFormValues, "status" | "repo_url" | "local_path">) {
  return values.status === "in_progress" && !values.repo_url && !values.local_path;
}
