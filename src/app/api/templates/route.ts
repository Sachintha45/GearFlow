import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'templates.json');

export async function GET() {
    try {
        const data = await fs.readFile(DB_PATH, 'utf-8');
        return NextResponse.json(JSON.parse(data));
    } catch (error) {
        return NextResponse.json([], { status: 200 });
    }
}

export async function POST(request: Request) {
    try {
        const newTemplate = await request.json();
        let templates = [];
        try {
            const data = await fs.readFile(DB_PATH, 'utf-8');
            templates = JSON.parse(data);
        } catch (e) {
            // File might not exist yet
        }

        // If template has an ID, update it, otherwise add new
        const index = templates.findIndex((t: any) => t.id === newTemplate.id);
        if (index > -1) {
            templates[index] = newTemplate;
        } else {
            templates.push(newTemplate);
        }

        await fs.writeFile(DB_PATH, JSON.stringify(templates, null, 2));
        return NextResponse.json({ success: true, templates });
    } catch (error) {
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
        return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 });
    }
}
