import { NextResponse } from "next/server";
import { addGroup, getGroups, removeGroup } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FB_GROUP_RE = /^https?:\/\/([\w-]+\.)?facebook\.com\/groups\/[^/]+/i;

export async function GET() {
  const groups = await getGroups();
  return NextResponse.json({ groups });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== "string" || typeof body.url !== "string") {
    return NextResponse.json({ error: "name and url are required" }, { status: 400 });
  }
  const name = body.name.trim();
  const url = body.url.trim();
  if (!name || !url) {
    return NextResponse.json({ error: "name and url are required" }, { status: 400 });
  }
  if (!FB_GROUP_RE.test(url)) {
    return NextResponse.json(
      { error: "URL must look like https://www.facebook.com/groups/<group>" },
      { status: 400 },
    );
  }
  const group = await addGroup({ name, url });
  return NextResponse.json({ group }, { status: 201 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  await removeGroup(id);
  return NextResponse.json({ ok: true });
}
