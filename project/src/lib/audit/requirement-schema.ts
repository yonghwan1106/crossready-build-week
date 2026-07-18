import { z } from "zod";

export const sourceLocatorSchema = z
  .object({
    artifactId: z.string().min(1).max(120),
    locatorType: z.enum([
      "page",
      "line",
      "section",
      "url",
      "frame",
      "metadata",
    ]),
    locator: z.string().min(1).max(300),
    excerpt: z.string().min(1).max(500),
  })
  .strict();

export const requirementSchema = z
  .object({
    id: z.string().regex(/^REQ-[0-9]{3}$/),
    statement: z.string().min(1).max(1_000),
    modality: z.enum(["MUST", "SHOULD", "MAY"]),
    scope: z.enum([
      "submission",
      "product",
      "technology",
      "media",
      "repository",
      "access",
      "legal",
    ]),
    criticality: z.enum(["blocking", "scored", "advisory"]),
    condition: z.string().max(500).nullable(),
    expectedEvidence: z
      .array(z.string().min(1).max(240))
      .min(1)
      .max(12),
    verificationMethods: z
      .array(
        z.enum(["deterministic", "semantic", "visual", "external", "human"]),
      )
      .min(1)
      .max(5),
    source: sourceLocatorSchema,
  })
  .strict()
  .superRefine((requirement, context) => {
    if (
      new Set(requirement.verificationMethods).size !==
      requirement.verificationMethods.length
    ) {
      context.addIssue({
        code: "custom",
        message: "verificationMethods must contain unique values",
        path: ["verificationMethods"],
      });
    }
  });

export const requirementSetSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    sourceArtifactId: z.string().min(1).max(120),
    sourceTitle: z.string().min(1).max(300),
    requirements: z.array(requirementSchema).min(1).max(75),
  })
  .strict();

export type RequirementSet = z.infer<typeof requirementSetSchema>;
