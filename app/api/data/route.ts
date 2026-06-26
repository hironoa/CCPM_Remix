import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const dataFilePath = path.join("/tmp", "local-data.json");

// Initialize with empty DB if not exists
function readDb() {
  if (!fs.existsSync(dataFilePath)) {
    const initialData = {
      projects: [],
      tasks: [],
      resources: [],
    };
    fs.writeFileSync(
      dataFilePath,
      JSON.stringify(initialData, null, 2),
      "utf-8",
    );
    return initialData;
  }
  const fileContent = fs.readFileSync(dataFilePath, "utf-8");
  return JSON.parse(fileContent);
}

function writeDb(data: any) {
  fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function GET() {
  try {
    const data = readDb();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: "Failed to read data" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    writeDb(data);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to save data" }, { status: 500 });
  }
}
