import { VerificationAdapterResult, VerificationStatus } from '../types/index.js';

export interface IVerificationAdapter {
  providerName: string;
  verify(referenceId: string, context?: Record<string, any>): Promise<VerificationAdapterResult>;
}

/**
 * Mock Land Registry Adapter (Bhu-Naksha / State Revenue Department)
 * Clearly marked DEMO SIMULATION
 */
export class BhuNakshaLandRegistryAdapter implements IVerificationAdapter {
  providerName = 'BHU_NAKSHA_STATE_LAND_REGISTRY';

  async verify(referenceId: string, context?: Record<string, any>): Promise<VerificationAdapterResult> {
    const requestedAt = new Date();

    // Deterministic simulation based on reference id
    if (!referenceId || referenceId.includes('INVALID') || referenceId.includes('DEFICIENT')) {
      return {
        provider: this.providerName,
        referenceId,
        requestedAt,
        status: 'MISMATCH_DETECTED',
        responseSummary: '[DEMO SIMULATION] Land record registry lookup returned ownership title mismatch with revenue records.',
        evidenceReference: `State Revenue Survey Registry Record #${referenceId || 'N/A'} (Khata Book Vol. 44)`,
        isDemoSimulation: true,
        rawResponse: {
          mutationStatus: 'Contested',
          khasraNumber: referenceId,
          registryOffice: 'District Revenue Sub-Registrar Office, Hyderabad',
          verifiedAt: requestedAt.toISOString(),
        },
      };
    }

    return {
      provider: this.providerName,
      referenceId,
      requestedAt,
      status: 'VERIFIED',
      responseSummary: '[DEMO SIMULATION] Registered clear title verified in State Revenue Land Bank with unencumbered educational institutional zoning.',
      evidenceReference: `State Revenue Survey Registry Record #${referenceId} (Book 1, Doc 1042/2018)`,
      isDemoSimulation: true,
      rawResponse: {
        mutationStatus: 'Clear and Certified',
        khasraNumber: referenceId,
        areaAcres: context?.areaAcres || 5.25,
        registryOffice: 'Sub-Registrar Office, Rangareddy / Pune / Nagpur',
        verifiedAt: requestedAt.toISOString(),
      },
    };
  }
}

/**
 * Mock Fire Safety NOC Adapter (Directorate of Fire and Emergency Services)
 * Clearly marked DEMO SIMULATION
 */
export class StateFireServicesAdapter implements IVerificationAdapter {
  providerName = 'STATE_FIRE_SERVICES_PORTAL';

  async verify(referenceId: string, context?: Record<string, any>): Promise<VerificationAdapterResult> {
    const requestedAt = new Date();

    if (referenceId.includes('EXP') || referenceId.includes('EXPIRED') || (context?.expiryDate && new Date(context.expiryDate) < new Date('2026-06-30'))) {
      return {
        provider: this.providerName,
        referenceId,
        requestedAt,
        status: 'EXPIRED',
        responseSummary: '[DEMO SIMULATION] Fire Safety Clearance order has lapsed. Periodic institutional fire mock drill compliance pending.',
        evidenceReference: `Directorate of Fire Services NOC Archive Ref #${referenceId}`,
        isDemoSimulation: true,
        rawResponse: {
          fireStationCircle: 'Central Operational Command',
          clearanceType: 'Provisional Educational Building Occupancy',
          validityStatus: 'EXPIRED',
          lastInspectedOn: '2024-11-10',
        },
      };
    }

    return {
      provider: this.providerName,
      referenceId,
      requestedAt,
      status: 'VERIFIED',
      responseSummary: '[DEMO SIMULATION] Operational Fire Safety Clearance verified active in State Fire Services Central Registry.',
      evidenceReference: `State Fire and Emergency Services NOC Archive Ref #${referenceId}`,
      isDemoSimulation: true,
      rawResponse: {
        fireStationCircle: 'Metropolitan Division',
        clearanceType: 'Final High-Rise Institutional Occupancy',
        validityStatus: 'ACTIVE',
        hydrantSystemOperational: true,
      },
    };
  }
}

/**
 * Mock Registrar of Societies & Trusts Adapter (MCA / Charity Commissioner)
 * Clearly marked DEMO SIMULATION
 */
export class RegistrarOfSocietiesAdapter implements IVerificationAdapter {
  providerName = 'MINISTRY_CORPORATE_AFFAIRS_CHARITY_COMMISSIONER';

  async verify(referenceId: string, context?: Record<string, any>): Promise<VerificationAdapterResult> {
    const requestedAt = new Date();

    if (referenceId.includes('MISMATCH') || referenceId.includes('DISPUTED')) {
      return {
        provider: this.providerName,
        referenceId,
        requestedAt,
        status: 'MISMATCH_DETECTED',
        responseSummary: '[DEMO SIMULATION] Governing body member resolution records reflect pending revision in registered trust deed.',
        evidenceReference: `Charity Commissioner Public Trust Registry #${referenceId}`,
        isDemoSimulation: true,
      };
    }

    return {
      provider: this.providerName,
      referenceId,
      requestedAt,
      status: 'VERIFIED',
      responseSummary: '[DEMO SIMULATION] Registered Public Educational Trust is in active standing with valid annual returns submitted.',
      evidenceReference: `Charity Commissioner Public Trust Registry #${referenceId}`,
      isDemoSimulation: true,
      rawResponse: {
        governingBodyActive: true,
        trustType: 'Non-Profit Educational Society',
        registeredDate: '1998-04-14',
      },
    };
  }
}

/**
 * Mock AICTE Central Portal Adapter
 * Clearly marked DEMO SIMULATION
 */
export class AicteCentralPortalAdapter implements IVerificationAdapter {
  providerName = 'AICTE_CENTRAL_PORTAL_DATABASE';

  async verify(referenceId: string, context?: Record<string, any>): Promise<VerificationAdapterResult> {
    const requestedAt = new Date();

    return {
      provider: this.providerName,
      referenceId,
      requestedAt,
      status: 'VERIFIED',
      responseSummary: '[DEMO SIMULATION] AICTE Permanent Institution ID verified against National Technical Education Database.',
      evidenceReference: `AICTE Central ERP Database Record #${referenceId}`,
      isDemoSimulation: true,
      rawResponse: {
        permanentId: referenceId,
        regionalOffice: 'South-Central / Western / Northern Region',
        nbaAccreditedBranches: 3,
        facultyCadreRatioStatus: 'Compliant',
      },
    };
  }
}

// Registry map of providers
export const verificationAdapters: Record<string, IVerificationAdapter> = {
  BHU_NAKSHA_STATE_LAND_REGISTRY: new BhuNakshaLandRegistryAdapter(),
  STATE_FIRE_SERVICES_PORTAL: new StateFireServicesAdapter(),
  MINISTRY_CORPORATE_AFFAIRS_CHARITY_COMMISSIONER: new RegistrarOfSocietiesAdapter(),
  AICTE_CENTRAL_PORTAL_DATABASE: new AicteCentralPortalAdapter(),
};
