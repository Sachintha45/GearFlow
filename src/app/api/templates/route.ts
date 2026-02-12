import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'templates.json');

export async function GET() {
    try {
        const data = await fs.readFile(DB_PATH, 'utf-8');
        return NextResponse.json(JSON.parse(data));
    } catch (error) {
        console.error("GET Templates Error:", error);
        return NextResponse.json([], { status: 200 });
    }
}

export async function POST(request: Request) {
    try {
        const newTemplate = await request.json();
        console.log("Saving new template:", newTemplate.name);

        let templates = [];
        try {
            const data = await fs.readFile(DB_PATH, 'utf-8');
            templates = JSON.parse(data);
        } catch (e) {
            console.log("No existing templates file found, creating new.");
        }

        const index = templates.findIndex((t: any) => t.id === newTemplate.id);
        if (index > -1) {
            templates[index] = newTemplate;
        } else {
            templates.push(newTemplate);
        }

        await fs.writeFile(DB_PATH, JSON.stringify(templates, null, 2));
        console.log("Template saved successfully. Total templates:", templates.length);

        return NextResponse.json({ success: true, templates });
    } catch (error) {
        console.error("POST Templates Error:", error);
        return NextResponse.json({ success: false, error: 'Failed to save' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { id } = await request.json();
        const data = await fs.readFile(DB_PATH, 'utf-8');
        let templates = JSON.parse(data);
        templates = templates.filter((t: any) => t.id !== id);
        await fs.writeFile(DB_PATH, JSON.stringify(templates, null, 2));
        return NextResponse.json({ success: true, templates });
    } catch (error) {
        console.error("DELETE Template Error:", error);
        return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 });
    }
}
