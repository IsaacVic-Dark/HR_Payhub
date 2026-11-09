"use client";

import { useParams } from "next/navigation";
import { TemplateEditor } from "../components/template-editor";

export default function EditTemplatePage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  if (!Number.isInteger(id) || id < 1) {
    return <p className="mx-6 mt-6 text-sm text-red-600">Invalid template id.</p>;
  }
  // key forces a clean editor state when navigating between templates
  return <TemplateEditor key={id} templateId={id} />;
}
