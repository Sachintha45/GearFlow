"use client";
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Save, Download, Plus, Trash2, Maximize, RotateCcw, Type, Image as LucideImage, Layers, AlignCenter, AlignVerticalJustifyCenter, Smartphone, Monitor } from 'lucide-react';

/**
 * Romota Pro Editor v3.1
 * Advanced Post Editor with Template Savings, Resizable Product Area, 
 * Dynamic Text Layers, and System Font Discovery.
 */

interface TextLayer {
    id: string;
    content: string;
    x: number;
    y: number;
    fontSize: number;
    fontFamily: string;
    color: string;
    bold: boolean;
}

interface Template {
    id: string;
    name: string;
    frameX: number;
    frameY: number;
    frameW: number;
    frameH: number;
    textLayers: TextLayer[];
    bgBase64?: string;
    prodBase64?: string;
    // Extra fields for legacy
    textColor: string;
    fontSize: number;
    fontFamily: string;
    prodName: string;
}

interface LayoutState {
    frameX: number;
    frameY: number;
    frameW: number;
    frameH: number;
    prodScale: number;
    prodOffsetX: number;
    prodOffsetY: number;
    textLayers: TextLayer[];
}

export default function RomotaEditor() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [bgImg, setBgImg] = useState<HTMLImageElement | null>(null);
    const [prodImg, setProdImg] = useState<HTMLImageElement | null>(null);

    // UI State
    const [isDragging, setIsDragging] = useState<string | null>(null); // 'frame', 'prod', 'text-{id}', 'resize-handle'
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [productGallery, setProductGallery] = useState<{ id: string, src: string }[]>([]);
    const [newTemplateName, setNewTemplateName] = useState("");
    const [availableFonts, setAvailableFonts] = useState<string[]>([
        "Impact", "Arial Black", "Verdana", "Tahoma", "Georgia", "Courier New",
        "Roboto", "Montserrat", "Oswald", "Inter"
    ]);

    // Dimensions State
    const [aspectRatio, setAspectRatio] = useState({ name: '1:1 Square', w: 1080, h: 1080 });
    const ratios = [
        { name: '1:1 Square', w: 1080, h: 1080 },
        { name: '4:5 Portrait', w: 1080, h: 1350 },
        { name: '16:9 Slide', w: 1920, h: 1080 },
        { name: '9:16 Story', w: 1080, h: 1920 }
    ];

    // Layout State
    const [layout, setLayout] = useState<LayoutState>({
        frameX: 200,
        frameY: 300,
        frameW: 680,
        frameH: 500,
        prodScale: 1,
        prodOffsetX: 0,
        prodOffsetY: 0,
        textLayers: [
            {
                id: 'default-title',
                content: "ENGINE OIL FILTER",
                x: 540,
                y: 180,
                fontSize: 70,
                fontFamily: "Impact",
                color: "#cc0000",
                bold: true
            }
        ]
    });

    // Detect system fonts (best effort)
    const loadSystemFonts = async () => {
        if (typeof window !== 'undefined' && 'queryLocalFonts' in window) {
            try {
                const fonts = await (window as any).queryLocalFonts();
                const names = Array.from(new Set(fonts.map((f: any) => String(f.family)))).sort() as string[];
                setAvailableFonts(prev => Array.from(new Set([...prev, ...names])));
                alert(`Loaded ${names.length} system fonts!`);
            } catch (e) {
                console.error("Font access denied", e);
                alert("Security blocked font access. Please click 'Scan System Fonts' manually.");
            }
        } else {
            alert("Your browser does not support local font access. Try Chrome or Edge.");
        }
    };

    // Load persisted data
    useEffect(() => {
        const loadInitialData = async () => {
            // 1. Load templates from Global DB
            try {
                const res = await fetch('/api/templates');
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    setTemplates(data);
                } else {
                    const local = localStorage.getItem('romota_v3_templates');
                    if (local) setTemplates(JSON.parse(local));
                }
            } catch (e) {
                const local = localStorage.getItem('romota_v3_templates');
                if (local) setTemplates(JSON.parse(local));
            }

            // 2. Load Gallery from Local Storage
            const savedGallery = localStorage.getItem('gearflow_gallery');
            if (savedGallery) setProductGallery(JSON.parse(savedGallery));

            // 3. Load last layout from local storage
            const savedLayout = localStorage.getItem('romota_v3_layout');
            if (savedLayout) {
                try {
                    setLayout(JSON.parse(savedLayout));
                } catch (e) { console.error("Error loading layout", e); }
            }
        };
        loadInitialData();
    }, []);

    // Redundant local save for templates
    useEffect(() => {
        if (templates.length > 0) {
            localStorage.setItem('romota_v3_templates', JSON.stringify(templates));
        }
    }, [templates]);

    // Auto-save templates
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('romota_v3_templates', JSON.stringify(templates));
        }
    }, [templates]);

    const draw = useCallback((isExporting = false) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const W = aspectRatio.w;
        const H = aspectRatio.h;

        ctx.clearRect(0, 0, W, H);

        // 1. Draw Background
        if (bgImg) {
            // Fill background maintaining aspect ratio (cover)
            const ratio = Math.max(W / bgImg.width, H / bgImg.height);
            const w = bgImg.width * ratio;
            const h = bgImg.height * ratio;
            ctx.drawImage(bgImg, (W - w) / 2, (H - h) / 2, w, h);
        } else {
            ctx.fillStyle = "#1e1e1e";
            ctx.fillRect(0, 0, W, H);
        }

        // 2. Draw Product Frame & Image
        ctx.save();
        ctx.beginPath();
        ctx.rect(layout.frameX, layout.frameY, layout.frameW, layout.frameH);

        // Visual Frame Border (only visible during editing/if no bg)
        if (!isExporting) {
            ctx.strokeStyle = "rgba(211, 47, 47, 0.4)";
            ctx.setLineDash([10, 5]);
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.clip();

        if (prodImg) {
            const w = prodImg.width * layout.prodScale;
            const h = prodImg.height * layout.prodScale;
            const x = (layout.frameX + layout.frameW / 2) - w / 2 + layout.prodOffsetX;
            const y = (layout.frameY + layout.frameH / 2) - h / 2 + layout.prodOffsetY;
            ctx.drawImage(prodImg, x, y, w, h);
        } else {
            // Placeholder Frame
            ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
            ctx.fillRect(layout.frameX, layout.frameY, layout.frameW, layout.frameH);
            ctx.font = "20px sans-serif";
            ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
            ctx.textAlign = "center";
            ctx.fillText("PRODUCT AREA", layout.frameX + layout.frameW / 2, layout.frameY + layout.frameH / 2);
        }
        ctx.restore();

        // 3. Draw Resize Handle (bottom right of frame)
        if (!isExporting) {
            ctx.fillStyle = "rgba(211, 47, 47, 0.8)";
            ctx.fillRect(layout.frameX + layout.frameW - 15, layout.frameY + layout.frameH - 15, 15, 15);
        }

        // 4. Draw Text Layers
        layout.textLayers.forEach(layer => {
            ctx.fillStyle = layer.color;
            ctx.font = `${layer.bold ? 'bold' : ''} ${layer.fontSize}px "${layer.fontFamily}"`;
            ctx.textAlign = "center";
            ctx.fillText(layer.content.toUpperCase(), layer.x, layer.y);

            // Visual outline if active
            if (!isExporting && activeLayerId === layer.id) {
                ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
                ctx.lineWidth = 1;
                ctx.setLineDash([5, 5]);
                const width = ctx.measureText(layer.content).width;
                ctx.strokeRect(layer.x - width / 2 - 10, layer.y - layer.fontSize, width + 20, layer.fontSize + 10);
            }
        });
    }, [layout, bgImg, prodImg, activeLayerId, aspectRatio]);

    useEffect(() => { draw(); }, [draw]);

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>, type: 'bg' | 'prod') => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (f) => {
            const img = new Image();
            img.onload = () => {
                if (type === 'bg') setBgImg(img);
                else setProdImg(img);
            };
            img.src = f.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const getMousePos = (e: React.MouseEvent) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (aspectRatio.w / rect.width),
            y: (e.clientY - rect.top) * (aspectRatio.h / rect.height)
        };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        const m = getMousePos(e);

        // 1. Check Resize Handle (Bottom-Right of Frame)
        if (m.x > layout.frameX + layout.frameW - 20 && m.x < layout.frameX + layout.frameW + 10 &&
            m.y > layout.frameY + layout.frameH - 20 && m.y < layout.frameY + layout.frameH + 10) {
            setIsDragging('resize-handle');
            return;
        }

        // 2. Check Text Layers (Top-to-Bottom)
        for (let i = layout.textLayers.length - 1; i >= 0; i--) {
            const layer = layout.textLayers[i];
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.font = `${layer.bold ? 'bold' : ''} ${layer.fontSize}px "${layer.fontFamily}"`;
                    const width = ctx.measureText(layer.content.toUpperCase()).width;
                    // Adjusted hit box: center is at x, and baseline is at y. 
                    // We check if mouse is within height and width.
                    if (Math.abs(m.y - (layer.y - layer.fontSize / 2)) < (layer.fontSize / 2 + 10) &&
                        Math.abs(m.x - layer.x) < (width / 2 + 20)) {
                        setIsDragging(`text-${layer.id}`);
                        setDragOffset({ x: m.x - layer.x, y: m.y - layer.y });
                        setActiveLayerId(layer.id);
                        return;
                    }
                }
            }
        }

        // 3. Check Frame
        if (m.x > layout.frameX && m.x < layout.frameX + layout.frameW &&
            m.y > layout.frameY && m.y < layout.frameY + layout.frameH) {
            if (e.shiftKey) {
                setIsDragging('frame');
                setDragOffset({ x: m.x - layout.frameX, y: m.y - layout.frameY });
            } else {
                setIsDragging('prod');
                setDragOffset({ x: m.x - layout.prodOffsetX, y: m.y - layout.prodOffsetY });
            }
            setActiveLayerId(null);
            return;
        }

        setActiveLayerId(null);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        const m = getMousePos(e);

        if (isDragging === 'resize-handle') {
            const newW = Math.max(50, m.x - layout.frameX);
            const newH = Math.max(50, m.y - layout.frameY);
            setLayout(prev => ({ ...prev, frameW: newW, frameH: newH }));
        } else if (isDragging.startsWith('text-')) {
            const id = isDragging.replace('text-', '');
            setLayout(prev => ({
                ...prev,
                textLayers: prev.textLayers.map(l =>
                    l.id === id ? { ...l, x: m.x - dragOffset.x, y: m.y - dragOffset.y } : l
                )
            }));
        } else if (isDragging === 'frame') {
            setLayout(prev => ({ ...prev, frameX: m.x - dragOffset.x, frameY: m.y - dragOffset.y }));
        } else if (isDragging === 'prod') {
            setLayout(prev => ({
                ...prev,
                prodOffsetX: m.x - dragOffset.x,
                prodOffsetY: m.y - dragOffset.y
            }));
        }
    };

    const handleMouseUp = () => setIsDragging(null);

    const handleWheel = (e: React.WheelEvent) => {
        if (!prodImg) return;
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        setLayout(prev => ({
            ...prev,
            prodScale: Math.max(0.01, Math.min(10, prev.prodScale + delta))
        }));
    };

    // Layout Actions
    const addTextLayer = () => {
        const newLayer: TextLayer = {
            id: `text-${Date.now()}`,
            content: "NEW TEXT",
            x: aspectRatio.w / 2,
            y: aspectRatio.h / 2,
            fontSize: 50,
            fontFamily: "Arial Black",
            color: "#ffffff",
            bold: true
        };
        setLayout(prev => ({ ...prev, textLayers: [...prev.textLayers, newLayer] }));
        setActiveLayerId(newLayer.id);
    };

    const deleteActiveLayer = () => {
        if (!activeLayerId) return;
        setLayout(prev => ({
            ...prev,
            textLayers: prev.textLayers.filter(l => l.id !== activeLayerId)
        }));
        setActiveLayerId(null);
    };

    const updateActiveLayer = (updates: Partial<TextLayer>) => {
        if (!activeLayerId) return;
        setLayout(prev => ({
            ...prev,
            textLayers: prev.textLayers.map(l => l.id === activeLayerId ? { ...l, ...updates } : l)
        }));
    };

    const alignActiveLayer = (type: 'h-center' | 'v-center') => {
        if (!activeLayerId) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        updateActiveLayer(type === 'h-center' ? { x: aspectRatio.w / 2 } : { y: aspectRatio.h / 2 });
    };

    const alignProduct = (type: 'h-center' | 'v-center') => {
        setLayout(prev => ({
            ...prev,
            prodOffsetX: type === 'h-center' ? 0 : prev.prodOffsetX,
            prodOffsetY: type === 'v-center' ? 0 : prev.prodOffsetY
        }));
    };

    // Template Operations
    const saveAsTemplate = async () => {
        if (!newTemplateName.trim()) {
            alert("Please enter a template name");
            return;
        }
        const template: Template = {
            id: `temp-${Date.now()}`,
            name: newTemplateName,
            frameX: layout.frameX,
            frameY: layout.frameY,
            frameW: layout.frameW,
            frameH: layout.frameH,
            textLayers: JSON.parse(JSON.stringify(layout.textLayers)),
            bgBase64: bgImg?.src,
            prodBase64: prodImg?.src,
            prodName: "", textColor: "#ffffff", fontSize: 50, fontFamily: "Impact"
        };

        try {
            const res = await fetch('/api/templates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(template)
            });
            const data = await res.json();
            if (data.success) {
                setTemplates(data.templates);
                setNewTemplateName("");
                alert(`Template "${template.name}" synced globally!`);
            }
        } catch (e) {
            console.error("Global sync failed", e);
            setTemplates([...templates, template]);
            setNewTemplateName("");
            alert(`Saved locally (Global sync failed)`);
        }
    };

    const deleteTemplate = async (id: string) => {
        try {
            const res = await fetch('/api/templates', {
                method: 'DELETE',
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (data.success) setTemplates(data.templates);
        } catch (e) {
            setTemplates(templates.filter(t => t.id !== id));
        }
    };

    const loadTemplate = (temp: Template) => {
        setLayout(prev => ({
            ...prev,
            frameX: temp.frameX,
            frameY: temp.frameY,
            frameW: temp.frameW,
            frameH: temp.frameH,
            textLayers: temp.textLayers.map(l => ({ ...l, id: `l-${Date.now()}-${Math.random()}` }))
        }));

        if (temp.bgBase64) {
            const img = new Image();
            img.onload = () => setBgImg(img);
            img.src = temp.bgBase64;
        }
        if (temp.prodBase64) {
            const img = new Image();
            img.onload = () => setProdImg(img);
            img.src = temp.prodBase64;
        }

        alert(`Template "${temp.name}" applied!`);
    };

    const activeLayer = layout.textLayers.find(l => l.id === activeLayerId);

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col md:flex-row p-4 gap-4 font-sans selection:bg-red-500/30">
            {/* Left Sidebar: Assets & Templates */}
            <div className="w-full md:w-80 flex flex-col gap-4 overflow-y-auto max-h-screen custom-scrollbar pb-8">
                {/* 1. Global Assets */}
                <div className="bg-[#141414] rounded-2xl p-4 border border-white/5 space-y-4 shadow-xl">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <Layers className="w-3 h-3" /> Canvas Settings
                    </h2>

                    <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 uppercase">Aspect Ratio</label>
                        <div className="grid grid-cols-2 gap-2">
                            {ratios.map(r => (
                                <button
                                    key={r.name}
                                    onClick={() => setAspectRatio(r)}
                                    className={`text-[9px] p-2 rounded-lg border transition-all ${aspectRatio.name === r.name ? 'bg-red-600 border-red-500 text-white' : 'bg-black border-white/5 text-gray-500 hover:border-white/20'}`}
                                >
                                    {r.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3 pt-2">
                        <div className="group">
                            <label className="text-[10px] text-gray-500 mb-1 block uppercase">Background Template</label>
                            <input type="file" onChange={(e) => handleFile(e, 'bg')} className="hidden" id="bg-upload" />
                            <label htmlFor="bg-upload" className="flex items-center gap-3 bg-[#1e1e1e] border border-white/5 p-2 rounded-xl cursor-pointer hover:bg-white/5 transition-colors">
                                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500"><Maximize className="w-4 h-4" /></div>
                                <span className="text-xs font-medium truncate">Upload Background</span>
                            </label>
                        </div>
                        <div className="group">
                            <label className="text-[10px] text-gray-500 mb-1 block uppercase">Product Cutout</label>
                            <input type="file" onChange={(e) => handleFile(e, 'prod')} className="hidden" id="prod-upload" />
                            <label htmlFor="prod-upload" className="flex items-center gap-3 bg-[#1e1e1e] border border-white/5 p-2 rounded-xl cursor-pointer hover:bg-white/5 transition-colors">
                                <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500"><LucideImage className="w-4 h-4" /></div>
                                <span className="text-xs font-medium truncate">Upload Product</span>
                            </label>
                        </div>
                        <div className="pt-2">
                            <button onClick={() => setLayout(p => ({ ...p, prodOffsetX: 0, prodOffsetY: 0 }))} className="w-full text-[10px] text-gray-400 py-2 border border-white/5 rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-all flex items-center justify-center gap-2 uppercase tracking-tighter">
                                <RotateCcw className="w-3 h-3" /> Reset Alignment
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. Product Gallery */}
                <div className="bg-[#141414] rounded-2xl p-4 border border-white/5 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <LucideImage className="w-3 h-3" /> Product Gallery
                        </h2>
                        {prodImg && (
                            <button
                                onClick={() => {
                                    const newItem = { id: `prod-${Date.now()}`, src: prodImg.src };
                                    const newGallery = [newItem, ...productGallery].slice(0, 12);
                                    setProductGallery(newGallery);
                                    localStorage.setItem('gearflow_gallery', JSON.stringify(newGallery));
                                }}
                                className="text-[9px] bg-red-600/10 text-red-500 px-2 py-1 rounded-lg border border-red-500/20 hover:bg-red-600 hover:text-white transition-all"
                            >
                                Add Current
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                        {productGallery.map(item => (
                            <div key={item.id} className="relative group aspect-square bg-black rounded-lg border border-white/5 overflow-hidden cursor-pointer hover:border-red-500/50 transition-all">
                                <img
                                    src={item.src}
                                    className="w-full h-full object-contain p-1"
                                    onClick={() => {
                                        const img = new Image();
                                        img.onload = () => setProdImg(img);
                                        img.src = item.src;
                                    }}
                                />
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const newGallery = productGallery.filter(i => i.id !== item.id);
                                        setProductGallery(newGallery);
                                        localStorage.setItem('gearflow_gallery', JSON.stringify(newGallery));
                                    }}
                                    className="absolute top-1 right-1 p-1 bg-black/60 rounded-md text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 className="w-2.5 h-2.5" />
                                </button>
                            </div>
                        ))}
                        {productGallery.length === 0 && (
                            <div className="col-span-3 py-6 text-center text-[10px] text-gray-600 italic">Gallery Empty</div>
                        )}
                    </div>
                </div>

                {/* 3. Template Manager */}
                <div className="bg-[#141414] rounded-2xl p-4 border border-white/5 space-y-4 shadow-xl">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <Save className="w-3 h-3" /> Templates
                    </h2>
                    <div className="flex gap-2">
                        <input
                            value={newTemplateName}
                            onChange={(e) => setNewTemplateName(e.target.value)}
                            placeholder="Template label..."
                            className="bg-black border border-white/10 rounded-lg px-2 py-1.5 text-xs flex-1 outline-none focus:border-red-500/50"
                        />
                        <button onClick={saveAsTemplate} className="bg-green-600 hover:bg-green-500 p-2 rounded-lg transition-colors">
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {templates.map(tmp => (
                            <div key={tmp.id} className="group flex items-center justify-between bg-black/40 border border-white/5 p-2 rounded-lg hover:bg-white/5 transition-colors">
                                <span className="text-xs text-gray-300 truncate">{tmp.name}</span>
                                <div className="flex gap-1">
                                    <button onClick={() => loadTemplate(tmp)} className="text-[10px] bg-red-600/20 text-red-400 px-2 py-1 rounded hover:bg-red-600 hover:text-white transition-colors">Apply</button>
                                    <button onClick={() => deleteTemplate(tmp.id)} className="text-gray-600 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                                </div>
                            </div>
                        ))}
                        {templates.length === 0 && <p className="text-[10px] text-gray-600 text-center py-4 italic">No saved layouts</p>}
                    </div>
                </div>
            </div>

            {/* Center Area: Canvas */}
            <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden bg-black rounded-[2rem] border border-white/5 shadow-inner">
                {/* Branding: GearFlow */}
                <div className="absolute top-4 left-6 z-20 flex items-center gap-3 group/brand">
                    <div className="relative">
                        <div className="absolute -inset-2 bg-gradient-to-r from-red-600 to-purple-600 rounded-full blur opacity-40 group-hover/brand:opacity-100 transition duration-1000 group-hover/brand:duration-200 animate-pulse"></div>
                        <div className="relative bg-black rounded-xl p-2 border border-white/10 shadow-2xl overflow-hidden">
                            <RotateCcw className="w-5 h-5 text-red-500 animate-[spin_10s_linear_infinite]" />
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-gray-500">
                            GEAR<span className="text-red-600">FLOW</span>
                        </h1>
                        <span className="text-[8px] text-gray-500 uppercase font-black tracking-[0.2em] -mt-1 pl-0.5">Automotive Pro Editor</span>
                    </div>
                </div>

                <div className="absolute top-4 right-6 z-10 bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-2xl flex items-center gap-4 max-sm:scale-75 max-sm:top-14 max-sm:left-6 max-sm:right-auto">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">Zoom</span>
                        <input
                            type="range"
                            min="0.1"
                            max="5"
                            step="0.01"
                            value={layout.prodScale}
                            onChange={(e) => setLayout(p => ({ ...p, prodScale: parseFloat(e.target.value) }))}
                            className="w-24 accent-red-600 h-1 bg-white/10 rounded-full"
                        />
                    </div>
                    <div className="h-6 w-px bg-white/10" />
                    <button onClick={addTextLayer} className="flex items-center gap-2 text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl transition-all border border-white/5">
                        <Plus className="w-3 h-3 text-red-500" /> Add Text
                    </button>
                </div>

                <div className="relative p-4 md:p-8 group w-full flex justify-center items-center h-full">
                    <canvas
                        ref={canvasRef}
                        width={aspectRatio.w}
                        height={aspectRatio.h}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onWheel={handleWheel}
                        className="max-h-[85vh] w-auto max-w-full h-auto shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/10 cursor-crosshair bg-[#050505] transition-transform duration-500 rounded-lg"
                        style={{ aspectRatio: `${aspectRatio.w} / ${aspectRatio.h}` }}
                    />
                </div>

                <div className="absolute bottom-6 flex gap-2 md:gap-4 bg-black/60 backdrop-blur-xl px-4 md:px-6 py-3 md:py-4 rounded-[1.5rem] md:rounded-[2rem] border border-white/10 shadow-2xl scale-90 md:scale-100 max-sm:bottom-4">
                    <button onClick={() => {
                        if (!canvasRef.current) return;
                        draw(true); // Hide guides before export
                        const link = document.createElement('a');
                        link.download = `GearFlow_${Date.now()}.png`;
                        link.href = canvasRef.current.toDataURL('image/png', 1.0);
                        link.click();
                        draw(false); // Restore guides after export
                    }} className="flex items-center gap-2 md:gap-3 bg-red-600 hover:bg-red-500 px-4 md:px-6 py-2.5 md:py-3 rounded-[1rem] md:rounded-2xl font-bold text-xs md:text-sm transition-all shadow-lg shadow-red-600/20 active:scale-95">
                        <Download className="w-4 h-4" /> DOWNLOAD
                    </button>
                    <button onClick={() => {
                        localStorage.setItem('romota_v3_layout', JSON.stringify(layout));
                        alert("Workspace autosaved.");
                    }} className="flex items-center gap-2 md:gap-3 bg-white/5 hover:bg-white/10 px-4 md:px-6 py-2.5 md:py-3 rounded-[1rem] md:rounded-2xl font-bold text-xs md:text-sm transition-all border border-white/5 whitespace-nowrap">
                        <Save className="w-4 h-4 text-green-500" /> SAVE STATE
                    </button>
                </div>
            </div>

            {/* Right Sidebar: Item Properties */}
            <div className="w-full md:w-80 flex flex-col gap-4">
                {activeLayer ? (
                    <div className="bg-[#141414] rounded-2xl p-4 border border-white/10 space-y-5 animate-in slide-in-from-right duration-300">
                        <div className="flex items-center justify-between border-b border-white/5 pb-3">
                            <h2 className="text-xs font-bold text-red-500 uppercase tracking-widest flex items-center gap-2">
                                <Type className="w-3 h-3" /> Edit Text
                            </h2>
                            <button onClick={deleteActiveLayer} className="p-1.5 hover:bg-red-500/10 text-gray-500 hover:text-red-500 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] text-gray-500 mb-1 block uppercase">Content</label>
                                <textarea
                                    value={activeLayer.content}
                                    onChange={(e) => updateActiveLayer({ content: e.target.value })}
                                    className="bg-black border border-white/10 w-full p-3 rounded-xl text-xs outline-none focus:border-red-600 transition-colors h-24 resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] text-gray-500 mb-1 block uppercase">Font Size</label>
                                    <input
                                        type="number"
                                        value={activeLayer.fontSize}
                                        onChange={(e) => updateActiveLayer({ fontSize: parseInt(e.target.value) || 0 })}
                                        className="bg-black border border-white/10 w-full p-2.5 rounded-xl text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 mb-1 block uppercase">Color</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            value={activeLayer.color}
                                            onChange={(e) => updateActiveLayer({ color: e.target.value })}
                                            className="w-full h-9 bg-transparent rounded-lg cursor-pointer border-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-[10px] text-gray-500 uppercase">Typeface</label>
                                    <button
                                        onClick={loadSystemFonts}
                                        className="text-[9px] text-red-500 hover:text-red-400 font-bold tracking-tighter"
                                    >
                                        SCAN SYSTEM FONTS
                                    </button>
                                </div>
                                <select
                                    value={activeLayer.fontFamily}
                                    onChange={(e) => updateActiveLayer({ fontFamily: e.target.value })}
                                    className="bg-black border border-white/10 w-full p-2.5 rounded-xl text-xs outline-none focus:border-red-600 transition-colors"
                                >
                                    <optgroup label="Standard Fonts">
                                        {availableFonts.slice(0, 10).map(f => (
                                            <option key={f} value={f}>{f}</option>
                                        ))}
                                    </optgroup>
                                    {availableFonts.length > 10 && (
                                        <optgroup label="System Fonts">
                                            {availableFonts.slice(10).map(f => (
                                                <option key={f} value={f}>{f}</option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                            </div>

                            <button
                                onClick={() => updateActiveLayer({ bold: !activeLayer.bold })}
                                className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all ${activeLayer.bold ? 'bg-red-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                            >
                                {activeLayer.bold ? 'BOLD ENABLED' : 'MAKE BOLD'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-[#141414] rounded-2xl p-6 border border-white/10 text-center flex flex-col items-center justify-center h-48 space-y-3">
                        <div className="p-4 bg-white/5 rounded-full text-gray-600">
                            <LucideImage className="w-8 h-8" />
                        </div>
                        <p className="text-xs text-gray-500">Select an item on canvas to edit properties</p>
                    </div>
                )}

                {/* Alignment Tools (Added when no specific layer is active but images are present) */}
                <div className="bg-[#141414] rounded-2xl p-4 border border-white/5 space-y-3">
                    <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <RotateCcw className="w-3 h-3" /> Quick Alignment
                    </h2>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => alignProduct('h-center')} className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 p-2 rounded-lg text-[10px] text-gray-400 border border-white/5 transition-all">
                            <AlignCenter className="w-3 h-3" /> Center Product H
                        </button>
                        <button onClick={() => alignProduct('v-center')} className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 p-2 rounded-lg text-[10px] text-gray-400 border border-white/5 transition-all">
                            <AlignVerticalJustifyCenter className="w-3 h-3" /> Center Product V
                        </button>
                        {activeLayer && (
                            <>
                                <button onClick={() => alignActiveLayer('h-center')} className="flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 p-2 rounded-lg text-[10px] text-red-500 border border-red-500/20 transition-all">
                                    <AlignCenter className="w-3 h-3" /> Center Text H
                                </button>
                                <button onClick={() => alignActiveLayer('v-center')} className="flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 p-2 rounded-lg text-[10px] text-red-500 border border-red-500/20 transition-all">
                                    <AlignVerticalJustifyCenter className="w-3 h-3" /> Center Text V
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Navigation Hint */}
                <div className="bg-[#141414]/50 rounded-2xl p-4 border border-white/5 space-y-2">
                    <p className="text-[9px] text-gray-600 uppercase font-black">Controls</p>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">Move Item</span>
                        <span className="text-[9px] bg-white/5 px-2 py-0.5 rounded text-gray-500">Left Click</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">Zoom Product</span>
                        <span className="text-[9px] bg-white/5 px-2 py-0.5 rounded text-gray-500">Range Slider</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">Resize Frame</span>
                        <span className="text-[9px] bg-red-500/20 px-2 py-0.5 rounded text-red-500 font-bold">Red Corner</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">Move Frame</span>
                        <span className="text-[9px] bg-white/5 px-2 py-0.5 rounded text-gray-500">Shift + Drag</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
