import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  Header,
  Footer,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  WidthType,
  ShadingType,
  VerticalAlign,
  LevelFormat,
  PageNumber,
  PageBreak,
  TableOfContents,
} from 'docx';
import * as fs from 'fs';
import * as path from 'path';

function createDocument(): Document {
  const tableBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' };
  const cellBorders = {
    top: tableBorder,
    bottom: tableBorder,
    left: tableBorder,
    right: tableBorder,
  };

  const headerShading = { fill: '0F172A', type: ShadingType.CLEAR };
  const zebraShading = { fill: 'F8FAFC', type: ShadingType.CLEAR };
  const clearShading = { fill: 'FFFFFF', type: ShadingType.CLEAR };

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 22, color: '1E293B' }, // 11pt default body text
        },
      },
      paragraphStyles: [
        {
          id: 'Title',
          name: 'Title',
          basedOn: 'Normal',
          run: { size: 52, bold: true, color: '0F172A', font: 'Arial' }, // 26pt
          paragraph: { spacing: { before: 240, after: 120 }, alignment: AlignmentType.CENTER },
        },
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 32, bold: true, color: '0F172A', font: 'Arial' }, // 16pt
          paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 0 },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 26, bold: true, color: '2563EB', font: 'Arial' }, // 13pt
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 22, bold: true, color: '334155', font: 'Arial' }, // 11pt
          paragraph: { spacing: { before: 180, after: 90 }, outlineLevel: 2 },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: 'bullet-list',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 }, spacing: { after: 80 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, // 1 inch margins (9360 DXA usable width)
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: '3D Warehouse Layout Builder & Spatial WMS — Specification Manual',
                    size: 18,
                    color: '64748B',
                    font: 'Arial',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Page ', size: 18, color: '64748B', font: 'Arial' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '64748B', font: 'Arial' }),
                  new TextRun({ text: ' of ', size: 18, color: '64748B', font: 'Arial' }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: '64748B', font: 'Arial' }),
                ],
              }),
            ],
          }),
        },
        children: [
          // TITLE COVER
          new Paragraph({
            spacing: { before: 720, after: 140 },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: '3D Warehouse Layout Builder\n& Spatial WMS',
                bold: true,
                size: 48,
                color: '0F172A',
                font: 'Arial',
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 100, after: 400 },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'System Architecture, Spatial Mathematics & Operational Engineering Manual',
                size: 24,
                color: '2563EB',
                font: 'Arial',
                italics: true,
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 100, after: 400 },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'Version 1.0.0 | Enterprise Edition | Production Ready',
                size: 20,
                color: '64748B',
                font: 'Arial',
              }),
            ],
          }),

          // Metadata Table
          new Table({
            columnWidths: [2600, 6760],
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    borders: cellBorders,
                    width: { size: 2600, type: WidthType.DXA },
                    shading: headerShading,
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: 'Specification Item', bold: true, color: 'FFFFFF' })],
                      }),
                    ],
                  }),
                  new TableCell({
                    borders: cellBorders,
                    width: { size: 6760, type: WidthType.DXA },
                    shading: headerShading,
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: 'System Specification Details', bold: true, color: 'FFFFFF' })],
                      }),
                    ],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    borders: cellBorders,
                    width: { size: 2600, type: WidthType.DXA },
                    shading: zebraShading,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Application Type', bold: true })] })],
                  }),
                  new TableCell({
                    borders: cellBorders,
                    width: { size: 6760, type: WidthType.DXA },
                    children: [new Paragraph({ children: [new TextRun('Interactive 3D Web CAD & Spatial Warehouse Management System')] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    borders: cellBorders,
                    width: { size: 2600, type: WidthType.DXA },
                    shading: zebraShading,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Core Stack', bold: true })] })],
                  }),
                  new TableCell({
                    borders: cellBorders,
                    width: { size: 6760, type: WidthType.DXA },
                    children: [new Paragraph({ children: [new TextRun('Next.js 16 (App Router), React 19, Three.js, React Three Fiber, Zustand 5')] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    borders: cellBorders,
                    width: { size: 2600, type: WidthType.DXA },
                    shading: zebraShading,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Database & ORM', bold: true })] })],
                  }),
                  new TableCell({
                    borders: cellBorders,
                    width: { size: 6760, type: WidthType.DXA },
                    children: [new Paragraph({ children: [new TextRun('Neon Serverless PostgreSQL (@neondatabase/serverless) & Drizzle ORM')] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    borders: cellBorders,
                    width: { size: 2600, type: WidthType.DXA },
                    shading: zebraShading,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Coordinate Unit', bold: true })] })],
                  }),
                  new TableCell({
                    borders: cellBorders,
                    width: { size: 6760, type: WidthType.DXA },
                    children: [new Paragraph({ children: [new TextRun('1.0 unit = 1.0 meter (Right-Handed Cartesian Y-Up convention)')] })],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { before: 240, after: 240 }, children: [new PageBreak()] }),

          // TABLE OF CONTENTS
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun('Table of Contents')],
          }),
          new TableOfContents('Table of Contents', {
            hyperlink: true,
            headingStyleRange: '1-3',
          }),

          new Paragraph({ spacing: { before: 240, after: 240 }, children: [new PageBreak()] }),

          // SECTION 1: EXECUTIVE SUMMARY
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun('1. Executive Summary & Product Vision')],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun(
                'Modern supply chain facilities face significant inefficiencies due to disconnects between architectural 2D CAD layouts and live Warehouse Management Systems (WMS). Planners design static blueprints without volumetric capacity awareness, while floor operators manage dynamic slotting without visual spatial context.'
              ),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun(
                'The 3D Web Warehouse Layout Builder bridges this gap by unifying high-performance WebGL 3D spatial modeling with relational WMS inventory slotting in a zero-install browser application. Designed for logistics engineers, warehouse managers, and systems integrators, the platform delivers instantaneous feedback on floor capacity, pick density, and structural clearances.'
              ),
            ],
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun('1.1 Core Value Pillars')],
          }),
          new Paragraph({
            numbering: { reference: 'bullet-list', level: 0 },
            children: [
              new TextRun({ text: 'Volumetric Precision: ', bold: true }),
              new TextRun('Real-time 3D simulation of selective pallet racks, cantilevers, drive-in systems, and bin slotting down to the centimeter.'),
            ],
          }),
          new Paragraph({
            numbering: { reference: 'bullet-list', level: 0 },
            children: [
              new TextRun({ text: 'Intelligent Spatial Snapping: ', bold: true }),
              new TextRun('Physics-guided AABB collision detection, face-to-face snap alignment, and warehouse perimeter containment.'),
            ],
          }),
          new Paragraph({
            numbering: { reference: 'bullet-list', level: 0 },
            children: [
              new TextRun({ text: 'Dynamic Picking Analytics: ', bold: true }),
              new TextRun('Live volumetric heatmaps that visualize pick velocity, inventory congestion, and ergonomic reach distribution.'),
            ],
          }),
          new Paragraph({
            numbering: { reference: 'bullet-list', level: 0 },
            children: [
              new TextRun({ text: 'Zero-Latency State Management: ', bold: true }),
              new TextRun('Transactional Command pattern with 30-level deep undo/redo, bulk operations, and instant database persistence.'),
            ],
          }),

          // SECTION 2: ARCHITECTURE & TECH STACK
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun('2. Architecture & System Design')],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun(
                'The system implements a decoupled three-tier architecture that isolates high-frequency 60 FPS WebGL rendering from React DOM UI state updates and server-side PostgreSQL persistence.'
              ),
            ],
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun('2.1 Technology Stack Matrix')],
          }),

          new Table({
            columnWidths: [2200, 2400, 4760],
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    borders: cellBorders,
                    width: { size: 2200, type: WidthType.DXA },
                    shading: headerShading,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Subsystem', bold: true, color: 'FFFFFF' })] })],
                  }),
                  new TableCell({
                    borders: cellBorders,
                    width: { size: 2400, type: WidthType.DXA },
                    shading: headerShading,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Technology', bold: true, color: 'FFFFFF' })] })],
                  }),
                  new TableCell({
                    borders: cellBorders,
                    width: { size: 4760, type: WidthType.DXA },
                    shading: headerShading,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Architectural Role', bold: true, color: 'FFFFFF' })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, width: { size: 2200, type: WidthType.DXA }, shading: zebraShading, children: [new Paragraph({ children: [new TextRun('Framework')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 2400, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Next.js 16.3 (App Router)')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 4760, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Full-stack orchestration, API routes, and SSR scaffolding.')] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, width: { size: 2200, type: WidthType.DXA }, shading: zebraShading, children: [new Paragraph({ children: [new TextRun('3D Rendering Engine')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 2400, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Three.js & React Three Fiber')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 4760, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Hardware-accelerated WebGL scene graph, instanced meshes & camera bus.')] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, width: { size: 2200, type: WidthType.DXA }, shading: zebraShading, children: [new Paragraph({ children: [new TextRun('State Management')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 2400, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Zustand 5.0')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 4760, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Slice-based store managing blueprints, multi-selection, and command stack.')] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, width: { size: 2200, type: WidthType.DXA }, shading: zebraShading, children: [new Paragraph({ children: [new TextRun('Database & Driver')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 2400, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Neon Serverless & node-postgres')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 4760, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Elastic cloud PostgreSQL with HTTP-based serverless pooling.')] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, width: { size: 2200, type: WidthType.DXA }, shading: zebraShading, children: [new Paragraph({ children: [new TextRun('ORM & Schema')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 2400, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Drizzle ORM 0.45')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 4760, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Type-safe relational modeling, migration generation, and queries.')] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, width: { size: 2200, type: WidthType.DXA }, shading: zebraShading, children: [new Paragraph({ children: [new TextRun('Validation & Types')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 2400, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Zod & TypeScript 5')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 4760, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Strict runtime contract verification and end-to-end static typing.')] })] }),
                ],
              }),
            ],
          }),

          // SECTION 3: 3D SPATIAL ENGINE & MATHEMATICS
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun('3. 3D Spatial Engine & Coordinate Geometry')],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun(
                'The spatial engine operates strictly in a standard right-handed Cartesian coordinate system where 1.0 unit equates exactly to 1.0 physical meter. The finished floor elevation defines the Y=0 plane, with positive Y extending upward toward the warehouse ceiling. The origin anchor (0,0,0) is fixed at the front-left bottom corner of the warehouse volume.'
              ),
            ],
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun('3.1 Snapping & Collision Pipeline')],
          }),
          new Paragraph({
            numbering: { reference: 'bullet-list', level: 0 },
            children: [
              new TextRun({ text: 'Grid Alignment: ', bold: true }),
              new TextRun('Calculates modulo offsets against user-selected snap intervals (0.5m or 1.0m) to enforce orderly aisle spacing.'),
            ],
          }),
          new Paragraph({
            numbering: { reference: 'bullet-list', level: 0 },
            children: [
              new TextRun({ text: 'Face-to-Face Rack Snapping: ', bold: true }),
              new TextRun('When an entity is moved within 0.3m of an adjacent rack, the engine calculates the minimum separating vector and aligns their bounding faces for seamless back-to-back or side-to-side runs.'),
            ],
          }),
          new Paragraph({
            numbering: { reference: 'bullet-list', level: 0 },
            children: [
              new TextRun({ text: 'Perimeter Clamping: ', bold: true }),
              new TextRun('Entities are strictly bounded within the warehouse floor boundaries [0, floor.width] and [0, floor.length], preventing out-of-bounds positioning.'),
            ],
          }),
          new Paragraph({
            numbering: { reference: 'bullet-list', level: 0 },
            children: [
              new TextRun({ text: 'AABB Collision Intersections: ', bold: true }),
              new TextRun('Overlapping Axis-Aligned Bounding Boxes with structural walls, columns, and other racks are highlighted with visual collision shaders and blocked from invalid placement.'),
            ],
          }),

          // SECTION 4: WMS & BIN SLOTTING
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun('4. Spatial WMS & Bin Slotting Architecture')],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun(
                'Unlike conventional 2D CAD systems that treat warehouse racks as empty geometric blocks, this platform models every storage bay and shelf level down to the individual bin slot.'
              ),
            ],
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun('4.1 Hierarchical Addressing Scheme')],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun(
                'Bin slots adhere to an industry-standard hierarchical addressing format: "Aisle-Bay-Level-Slot" (e.g., A01-02-03). Each bin slot record maintains:'
              ),
            ],
          }),
          new Paragraph({
            numbering: { reference: 'bullet-list', level: 0 },
            children: [
              new TextRun({ text: 'Relative 3D Coordinates: ', bold: true }),
              new TextRun('Local offset from the rack base center to the exact pallet load position.'),
            ],
          }),
          new Paragraph({
            numbering: { reference: 'bullet-list', level: 0 },
            children: [
              new TextRun({ text: 'Weight Capacity Limits: ', bold: true }),
              new TextRun('Defines maximum rated structural payload (default 1,000 kg per pallet position) with overload warning flags.'),
            ],
          }),
          new Paragraph({
            numbering: { reference: 'bullet-list', level: 0 },
            children: [
              new TextRun({ text: 'Occupancy & SKU Metadata: ', bold: true }),
              new TextRun('Tracks live SKU code, product title, quantity, and pick frequency velocity tiers (Fast, Medium, Slow).'),
            ],
          }),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun('4.2 Heatmap Analytics Engine')],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun(
                'The built-in analytics engine computes localized pick density across the facility. High-frequency pick zones are mapped using dynamic color gradients (green for high-velocity fast movers, amber for medium, blue for slow movers), allowing logistics planners to optimize travel distances and minimize forklift congestion.'
              ),
            ],
          }),

          // SECTION 5: STATE & COMMAND PATTERN
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun('5. State Management & Command Pattern')],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun(
                'The editor employs Zustand slices combined with the Command Pattern. Every user action that alters the warehouse layout is encapsulated inside an ICommand object, providing an immutable history record that supports seamless undo and redo operations.'
              ),
            ],
          }),
          new Paragraph({
            numbering: { reference: 'bullet-list', level: 0 },
            children: [
              new TextRun({ text: 'Add/Remove Entity Commands: ', bold: true }),
              new TextRun('Encapsulate entity creation, removal, and bin regeneration.'),
            ],
          }),
          new Paragraph({
            numbering: { reference: 'bullet-list', level: 0 },
            children: [
              new TextRun({ text: 'Move & Rotate Commands: ', bold: true }),
              new TextRun('Store initial and target 3D vectors/rotations, restoring previous states upon undo.'),
            ],
          }),
          new Paragraph({
            numbering: { reference: 'bullet-list', level: 0 },
            children: [
              new TextRun({ text: 'Bulk Commands: ', bold: true }),
              new TextRun('Permits atomic multi-entity operations including bulk duplicate (Ctrl+D), bulk rotate (R), and bulk delete.'),
            ],
          }),

          // SECTION 6: SMOKE TESTING MATRIX
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun('6. Verification & Quality Assurance Suite')],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun(
                'To guarantee 100% operational reliability, the project includes 13 deterministic smoke and integration test scripts executable directly via npm scripts without running a live browser.'
              ),
            ],
          }),

          new Table({
            columnWidths: [3000, 6360],
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    borders: cellBorders,
                    width: { size: 3000, type: WidthType.DXA },
                    shading: headerShading,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Smoke Test Command', bold: true, color: 'FFFFFF' })] })],
                  }),
                  new TableCell({
                    borders: cellBorders,
                    width: { size: 6360, type: WidthType.DXA },
                    shading: headerShading,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Scope & Verification Coverage', bold: true, color: 'FFFFFF' })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, width: { size: 3000, type: WidthType.DXA }, shading: zebraShading, children: [new Paragraph({ children: [new TextRun('npm run test:smoke')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 6360, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Core Zustand store mutations, rack addition, bin auto-generation, undo/redo stack depth.')] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, width: { size: 3000, type: WidthType.DXA }, shading: zebraShading, children: [new Paragraph({ children: [new TextRun('npm run test:snapping')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 6360, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Spatial math, AABB overlap calculation, edge/face snap thresholds, perimeter clamping.')] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, width: { size: 3000, type: WidthType.DXA }, shading: zebraShading, children: [new Paragraph({ children: [new TextRun('npm run test:persistence')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 6360, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Full round-trip JSON serialization and database hydration matching Drizzle schema.')] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, width: { size: 3000, type: WidthType.DXA }, shading: zebraShading, children: [new Paragraph({ children: [new TextRun('npm run test:wms')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 6360, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Bin slot indexing, bay/level coordinate math, occupancy flags, max weight capacity.')] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, width: { size: 3000, type: WidthType.DXA }, shading: zebraShading, children: [new Paragraph({ children: [new TextRun('npm run test:heatmap')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 6360, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Heatmap density gradients, pick velocity scoring, occupancy analytics computation.')] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, width: { size: 3000, type: WidthType.DXA }, shading: zebraShading, children: [new Paragraph({ children: [new TextRun('npm run test:hitboxes')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 6360, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('3D raycasting, pointer hit detection, bounding volume ray intersection accuracy.')] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, width: { size: 3000, type: WidthType.DXA }, shading: zebraShading, children: [new Paragraph({ children: [new TextRun('npm run test:direct-drag')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 6360, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Direct pointer drag gesture on ground plane, camera focus target tracking.')] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, width: { size: 3000, type: WidthType.DXA }, shading: zebraShading, children: [new Paragraph({ children: [new TextRun('npm run test:multi-select')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 6360, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Marquee box selection, bulk duplicate, bulk rotation, bulk deletion transactions.')] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, width: { size: 3000, type: WidthType.DXA }, shading: zebraShading, children: [new Paragraph({ children: [new TextRun('npm run test:templates')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 6360, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Warehouse blueprint templates (Fulfillment, Cold Storage, Bulk) and telemetry.')] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, width: { size: 3000, type: WidthType.DXA }, shading: zebraShading, children: [new Paragraph({ children: [new TextRun('npm run test:tour')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 6360, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Interactive guided onboarding tour state machine and target element highlighting.')] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, width: { size: 3000, type: WidthType.DXA }, shading: zebraShading, children: [new Paragraph({ children: [new TextRun('npm run test:settings')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 6360, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Unit conversion math (metric/imperial), theme reactivity, i18n dictionaries parity.')] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, width: { size: 3000, type: WidthType.DXA }, shading: zebraShading, children: [new Paragraph({ children: [new TextRun('npm run test:e2e')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 6360, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Headless Playwright end-to-end browser automation and layout creation validation.')] })] }),
                ],
              }),
            ],
          }),

          // SECTION 7: KEYBOARD SHORTCUTS
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun('7. Keyboard Shortcuts & Operational Reference')],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun(
                'The editor incorporates rapid-entry keyboard bindings optimized for professional layout planners:'
              ),
            ],
          }),

          new Table({
            columnWidths: [2400, 2400, 4560],
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    borders: cellBorders,
                    width: { size: 2400, type: WidthType.DXA },
                    shading: headerShading,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Shortcut Key', bold: true, color: 'FFFFFF' })] })],
                  }),
                  new TableCell({
                    borders: cellBorders,
                    width: { size: 2400, type: WidthType.DXA },
                    shading: headerShading,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Operation Name', bold: true, color: 'FFFFFF' })] })],
                  }),
                  new TableCell({
                    borders: cellBorders,
                    width: { size: 4560, type: WidthType.DXA },
                    shading: headerShading,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Functional Behavior', bold: true, color: 'FFFFFF' })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, width: { size: 2400, type: WidthType.DXA }, shading: zebraShading, children: [new Paragraph({ children: [new TextRun('R')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 2400, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Rotate 90°')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 4560, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Rotates active selection clockwise by 90 degrees around Y-axis.')] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, width: { size: 2400, type: WidthType.DXA }, shading: zebraShading, children: [new Paragraph({ children: [new TextRun('Delete / Backspace')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 2400, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Remove Entity')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 4560, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Deletes selected racks, structures, or zones (undoable).')] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, width: { size: 2400, type: WidthType.DXA }, shading: zebraShading, children: [new Paragraph({ children: [new TextRun('Ctrl + Z')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 2400, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Undo')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 4560, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Reverts the most recent command on the undo stack.')] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, width: { size: 2400, type: WidthType.DXA }, shading: zebraShading, children: [new Paragraph({ children: [new TextRun('Ctrl + Y / Ctrl+Shift+Z')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 2400, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Redo')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 4560, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Re-applies the most recently reverted command.')] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, width: { size: 2400, type: WidthType.DXA }, shading: zebraShading, children: [new Paragraph({ children: [new TextRun('Ctrl + D')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 2400, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Bulk Duplicate')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 4560, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Duplicates all selected entities with a default spatial offset.')] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, width: { size: 2400, type: WidthType.DXA }, shading: zebraShading, children: [new Paragraph({ children: [new TextRun('F')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 2400, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Focus Entity')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 4560, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Interpolates camera target smoothly to frame the selected item.')] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, width: { size: 2400, type: WidthType.DXA }, shading: zebraShading, children: [new Paragraph({ children: [new TextRun('Space')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 2400, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Reset Viewport')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 4560, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Returns camera to default 45° isometric warehouse overview.')] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, width: { size: 2400, type: WidthType.DXA }, shading: zebraShading, children: [new Paragraph({ children: [new TextRun('G')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 2400, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Toggle Grid Snap')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 4560, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Enables or disables spatial grid snapping on pointer drag.')] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: cellBorders, width: { size: 2400, type: WidthType.DXA }, shading: zebraShading, children: [new Paragraph({ children: [new TextRun('2 / 3')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 2400, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('2D / 3D Mode')] })] }),
                  new TableCell({ borders: cellBorders, width: { size: 4560, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('Toggles between 2D top-down plan view and 3D perspective mode.')] })] }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });
}

async function main() {
  const outputPath = path.resolve(process.cwd(), '3D_Warehouse_Layout_Builder_Documentation.docx');
  console.log(`Generating Word document at: ${outputPath}`);
  const doc = createDocument();
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  console.log(`Successfully generated: 3D_Warehouse_Layout_Builder_Documentation.docx (${(buffer.length / 1024).toFixed(1)} KB)`);
}

main().catch((err) => {
  console.error('Error generating document:', err);
  process.exit(1);
});
