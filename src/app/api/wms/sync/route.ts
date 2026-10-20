// Fulfills Phase 42: Next.js REST API Route for External WMS / ERP Inbound Sync.
// Supports programmatic integration with SAP S/4HANA, Odoo, and custom enterprise WMS.

import { NextRequest, NextResponse } from 'next/server';
import { WmsSyncPayloadSchema, type WmsSyncResponse } from '@/lib/validations/wms-sync-schema';
import { getWarehouseLayout, persistWarehouseLayout } from '@/app/actions/layout-actions';

const WMS_SECRET_TOKEN = process.env.WMS_API_KEY || 'wms-demo-secret-key';

function authenticateRequest(req: NextRequest): boolean {
  const isDev = process.env.NODE_ENV !== 'production';
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    // In dev mode allow query param token ?token=
    const tokenQuery = req.nextUrl.searchParams.get('token');
    return tokenQuery === WMS_SECRET_TOKEN || (isDev && tokenQuery === 'demo');
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  return token === WMS_SECRET_TOKEN || (isDev && token === 'demo');
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate
    if (!authenticateRequest(req)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized: Invalid or missing Bearer token in Authorization header.',
        },
        { status: 401 }
      );
    }

    // 2. Parse Body
    let bodyUnknown: unknown;
    try {
      bodyUnknown = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body.' },
        { status: 400 }
      );
    }

    // 3. Validate Zod Payload
    const parsed = WmsSyncPayloadSchema.safeParse(bodyUnknown);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          issues: parsed.error.issues,
        },
        { status: 422 }
      );
    }

    const payload = parsed.data;
    const directMatched = payload.items.filter((i) => !!i.binId);
    const unallocated = payload.items.filter((i) => !i.binId);

    // 4. Retrieve Blueprint and verify existence
    const blueprint = await getWarehouseLayout(payload.blueprintId);
    if (!blueprint) {
      return NextResponse.json(
        {
          success: false,
          error: `Warehouse blueprint with ID "${payload.blueprintId}" was not found.`,
        },
        { status: 404 }
      );
    }

    let actualAllocatedCount = 0;

    // 5. Persist Direct-Matched Inventory updates when available
    if (directMatched.length > 0) {
      const itemMap = new Map(directMatched.map((item) => [item.binId!, item]));
      const updatedRacks = blueprint.racks.map((rack) => ({
        ...rack,
        bins: rack.bins.map((bin) => {
          const incoming = itemMap.get(bin.id);
          if (incoming) {
            actualAllocatedCount++;
            return {
              ...bin,
              isOccupied: true,
              skuData: {
                sku: incoming.sku,
                productName: incoming.productName,
                quantity: incoming.quantity,
                unit: incoming.unit || 'units',
                lotNumber: incoming.lotNumber || '',
                weightKg: incoming.weightKg || 0,
                velocityClass: incoming.velocityClass,
                expiryDate: incoming.expiryDate,
              },
            };
          }
          return bin;
        }),
      }));

      const systemSession = {
        session: {
          id: 'wms-api-session',
          userId: 'system-wms-sync',
          expiresAt: new Date(Date.now() + 3600 * 1000),
          createdAt: new Date(),
        },
        user: {
          id: 'system-wms-sync',
          name: 'WMS Integration Service',
          email: 'wms@system.local',
          role: 'ADMIN' as const,
        },
      };

      const persistResult = await persistWarehouseLayout(
        {
          ...blueprint,
          racks: updatedRacks,
        },
        systemSession
      );

      if (!persistResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: `Failed to persist WMS sync updates: ${persistResult.error || 'Unknown error'}`,
          },
          { status: 500 }
        );
      }
    }

    const response: WmsSyncResponse = {
      success: true,
      blueprintId: payload.blueprintId,
      processedCount: payload.items.length,
      directMatchedCount: actualAllocatedCount,
      unallocatedCount: unallocated.length,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
