/**
 * Wallet/Settlement Cloud Sync Utilities
 * Handles saving/loading settlements to/from AWS Amplify DynamoDB
 */

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import type { Settlement } from '../state/store';

let cachedClient: ReturnType<typeof generateClient<Schema>> | null = null;
function getClient() {
  if (import.meta.env.VITE_ENABLE_CLOUD_SYNC !== 'true') return null;
  if (cachedClient) return cachedClient;
  try {
    cachedClient = generateClient<Schema>();
    return cachedClient;
  } catch (e) {
    console.warn('❌ Amplify client unavailable (local/offline mode)', e);
    return null;
  }
}

/**
 * Save settlement to cloud (DynamoDB)
 */
export async function saveSettlementToCloud(settlement: Settlement): Promise<boolean> {
  try {
    const client = getClient();
    if (!client) return false;

    console.log('💰 saveSettlementToCloud: Saving settlement:', settlement.id);

    const cloudData = {
      id: settlement.id,
      eventId: settlement.eventId,
      eventName: settlement.eventName || undefined,
      fromProfileId: settlement.fromProfileId,
      fromProfileName: settlement.fromName || undefined,
      toProfileId: settlement.toProfileId,
      toProfileName: settlement.toName || undefined,
      amount: settlement.roundedAmount, // Store the rounded amount as the main amount
      currency: 'USD',
      status: settlement.status,
      paidAt: settlement.paidAt || undefined,
      paymentMethod: settlement.paidMethod || undefined,
      breakdownJson: JSON.stringify({
        calculatedAmount: settlement.calculatedAmount,
        roundedAmount: settlement.roundedAmount,
        tipFundAmount: settlement.tipFundAmount,
        date: settlement.date,
      }),
      note: settlement.notes || undefined,
    };

    // Try update first, then create if not exists
    const { data, errors } = await client.models.Settlement.update(cloudData);

    if (errors || !data) {
      console.log('💰 saveSettlementToCloud: Update failed, attempting create...');
      const createResult = await client.models.Settlement.create(cloudData);
      
      if (createResult.errors) {
        console.error('❌ saveSettlementToCloud: Create failed:', createResult.errors);
        return false;
      }
      
      console.log('✅ saveSettlementToCloud: Settlement CREATED in cloud');
      return true;
    }

    console.log('✅ saveSettlementToCloud: Settlement UPDATED in cloud');
    return true;
  } catch (error) {
    console.error('❌ saveSettlementToCloud: Error:', error);
    return false;
  }
}

/**
 * Save multiple settlements to cloud (batch)
 */
export async function saveSettlementsToCloud(settlements: Settlement[]): Promise<number> {
  let successCount = 0;
  for (const settlement of settlements) {
    const success = await saveSettlementToCloud(settlement);
    if (success) successCount++;
  }
  console.log(`💰 saveSettlementsToCloud: Saved ${successCount}/${settlements.length} settlements`);
  return successCount;
}

/**
 * Load settlements for a profile (where they owe or are owed)
 */
export async function loadSettlementsForProfile(profileId: string): Promise<Settlement[]> {
  try {
    const client = getClient();
    if (!client) return [];

    console.log('📥 loadSettlementsForProfile: Loading settlements for:', profileId);

    // Get settlements where user is the payer
    const { data: fromSettlements, errors: fromErrors } = await client.models.Settlement.list({
      filter: { fromProfileId: { eq: profileId } }
    });

    // Get settlements where user is the recipient
    const { data: toSettlements, errors: toErrors } = await client.models.Settlement.list({
      filter: { toProfileId: { eq: profileId } }
    });

    if (fromErrors || toErrors) {
      console.error('❌ loadSettlementsForProfile: Error:', fromErrors || toErrors);
      return [];
    }

    // Combine and dedupe
    const allCloud = [...(fromSettlements || []), ...(toSettlements || [])];
    const seen = new Set<string>();
    const uniqueCloud = allCloud.filter(s => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });

    const settlements = uniqueCloud.map(cloudSettlementToLocal);
    console.log(`✅ loadSettlementsForProfile: Loaded ${settlements.length} settlements`);
    return settlements;
  } catch (error) {
    console.error('❌ loadSettlementsForProfile: Error:', error);
    return [];
  }
}

/**
 * Load settlements for an event
 */
export async function loadSettlementsForEvent(eventId: string): Promise<Settlement[]> {
  try {
    const client = getClient();
    if (!client) return [];

    console.log('📥 loadSettlementsForEvent: Loading settlements for event:', eventId);

    const { data: cloudSettlements, errors } = await client.models.Settlement.list({
      filter: { eventId: { eq: eventId } }
    });

    if (errors || !cloudSettlements) {
      console.error('❌ loadSettlementsForEvent: Error:', errors);
      return [];
    }

    const settlements = cloudSettlements.map(cloudSettlementToLocal);
    console.log(`✅ loadSettlementsForEvent: Loaded ${settlements.length} settlements`);
    return settlements;
  } catch (error) {
    console.error('❌ loadSettlementsForEvent: Error:', error);
    return [];
  }
}

/**
 * Update settlement status (mark paid, forgiven, etc.)
 */
export async function updateSettlementStatus(
  settlementId: string, 
  status: 'pending' | 'paid' | 'forgiven' | 'disputed',
  paymentMethod?: string
): Promise<boolean> {
  try {
    const client = getClient();
    if (!client) return false;

    console.log('💰 updateSettlementStatus:', settlementId, '→', status);

    const updateData: any = {
      id: settlementId,
      status,
    };

    if (status === 'paid') {
      updateData.paidAt = new Date().toISOString();
      if (paymentMethod) {
        updateData.paymentMethod = paymentMethod;
      }
    }

    const { errors } = await client.models.Settlement.update(updateData);

    if (errors) {
      console.error('❌ updateSettlementStatus: Error:', errors);
      return false;
    }

    console.log('✅ updateSettlementStatus: Status updated');
    return true;
  } catch (error) {
    console.error('❌ updateSettlementStatus: Error:', error);
    return false;
  }
}

/**
 * Delete settlement from cloud
 */
export async function deleteSettlementFromCloud(settlementId: string): Promise<boolean> {
  try {
    const client = getClient();
    if (!client) return false;

    console.log('🗑️ deleteSettlementFromCloud: Deleting settlement:', settlementId);

    const { errors } = await client.models.Settlement.delete({ id: settlementId });

    if (errors) {
      console.error('❌ deleteSettlementFromCloud: Error:', errors);
      return false;
    }

    console.log('✅ deleteSettlementFromCloud: Settlement deleted');
    return true;
  } catch (error) {
    console.error('❌ deleteSettlementFromCloud: Error:', error);
    return false;
  }
}

/**
 * Convert cloud settlement to local format
 */
function cloudSettlementToLocal(cloudSettlement: any): Settlement {
  // Parse breakdown JSON for additional fields
  const breakdown = cloudSettlement.breakdownJson 
    ? JSON.parse(cloudSettlement.breakdownJson as string) 
    : {};

  return {
    id: cloudSettlement.id,
    eventId: cloudSettlement.eventId,
    eventName: cloudSettlement.eventName || '',
    date: breakdown.date || cloudSettlement.createdAt?.split('T')[0] || '',
    
    // Who owes whom
    fromProfileId: cloudSettlement.fromProfileId,
    fromName: cloudSettlement.fromProfileName || '',
    toProfileId: cloudSettlement.toProfileId,
    toName: cloudSettlement.toProfileName || '',
    
    // Amounts - restore from breakdown or use main amount
    calculatedAmount: breakdown.calculatedAmount ?? cloudSettlement.amount,
    roundedAmount: breakdown.roundedAmount ?? cloudSettlement.amount,
    tipFundAmount: breakdown.tipFundAmount ?? 0,
    
    // Status
    status: cloudSettlement.status || 'pending',
    paidAt: cloudSettlement.paidAt || undefined,
    paidMethod: cloudSettlement.paymentMethod || undefined,
    notes: cloudSettlement.note || undefined,
    
    createdAt: cloudSettlement.createdAt,
  };
}
