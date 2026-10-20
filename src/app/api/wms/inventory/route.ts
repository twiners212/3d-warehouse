// Fulfills Phase 42: Next.js REST API Route for External WMS / ERP Inventory Retrieval.
// Supports querying current inventory for digital twin integration.

import { NextRequest, NextResponse } from 'next/server';
import { getWarehouseLayout } from '@/app/actions/layout-actions';

const WMS_SECRET_TOKEN = process.env.WMS_API_KEY || 'wms-demo-secret-key';

function authenticateRequest(req: NextRequest): boolean {
  const isDev = process.env.NODE_ENV !== 'production';
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    const tokenQuery = req.nextUrl.searchParams.get('token');
    return tokenQuery === WMS_SECRET_TOKEN || (isDev && tokenQuery === 'demo');
  }
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  return token === WMS_SECRET_TOKEN || (isDev && token === 'demo');
}

export async function GET(req: NextRequest) {
  try {
    if (!authenticateRequest(req)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized: Invalid or missing Bearer token in Authorization header.',
        },
        { status: 401 }
      );
    }

    const blueprintId = req.nextUrl.searchParams.get('blueprintId');
    if (!blueprintId) {
      return NextResponse.json(
        { success: false, error: 'Query parameter "blueprintId" is required.' },
        { status: 400 }
      );
    }

    const blueprint = await getWarehouseLayout(blueprintId);
    if (!blueprint) {
      return NextResponse.json(
        { success: false, error: `Blueprint "${blueprintId}" not found.` },
        { status: 404 }
      );
    }

    const inventoryItems = [];
    let totalBins = 0;
    let occupiedBins = 0;

    for (const rack of blueprint.racks) {
      for (const bin of rack.bins) {
        totalBins++;
        if (bin.isOccupied) {
          occupiedBins++;
        }
        inventoryItems.push({
          binId: bin.id,
          rackId: rack.id,
          rackName: rack.name,
          bayIndex: bin.bayIndex,
          levelIndex: bin.levelIndex,
          isOccupied: bin.isOccupied,
          skuData: bin.skuData,
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        blueprintId,
        queryTime: new Date().toISOString(),
        summary: {
          totalBins,
          occupiedBins,
          availableBins: totalBins - occupiedBins,
          occupancyRate: totalBins > 0 ? Math.round((occupiedBins / totalBins) * 100) : 0,
        },
        items: inventoryItems,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
