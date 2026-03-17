'use strict';
/**
 * RequirementsTemplate - Blank Canadian Public Sector procurement requirements template
 * Used by the AI to initialize the document structure before filling it in.
 */

export const REQUIREMENTS_TEMPLATE = `Requirement Definition Document

Document Title: Scope of Work / Supply
Procurement Type: TBD
Organization / Branch: TBD
Prepared By: TBD
Date: TBD
Version: 1.0
RFX / File Number: TBD

==================================================

A. Opportunity Overview

A1. Purpose
TBD

A2. Objectives
- TBD
- TBD
- TBD

==================================================

B. Scope Boundaries

B1. In Scope
- TBD

B2. Out of Scope
- TBD

B3. Assumptions, Constraints, and Dependencies
Assumptions: TBD
Constraints: TBD
Dependencies: TBD

==================================================

C. Background and Current State

C1. Current Environment
TBD

C2. Volumes and Scale
Users / stakeholders: TBD
Transactions / volume: TBD
Sites / locations: TBD
Growth expectations: TBD

==================================================

D. Supplier Deliverables

D1. Deliverables
1. Deliverable: TBD
  Description / Format: TBD
  Inclusions / Exclusions: TBD

D2. Acceptance Criteria
- TBD

D3. Milestones and Timeline
Kickoff: TBD
Go-live / Delivery: TBD
First review: TBD

==================================================

G. Requirements

G1. Functional Requirements
Must: TBD
Should: TBD

G2. Non-Functional Requirements
Availability / uptime: TBD
Performance: TBD
Scalability: TBD
Usability / accessibility: TBD

==================================================

I. Compliance, Privacy, and Security

Privacy: TBD
Data Residency: TBD
Security: TBD
Accessibility: TBD
Additional compliance requirements: TBD

==================================================

J. Locations and Logistics

Delivery / service locations: TBD
On-site work required: TBD
Travel expectations: TBD

==================================================

Open Questions and Assumptions

- TBD
`;

/**
 * Section headers used for targeted section updates
 */
export const SECTION_HEADERS: Record<string, string> = {
  header: 'Requirement Definition Document',
  purpose: 'A1. Purpose',
  objectives: 'A2. Objectives',
  inScope: 'B1. In Scope',
  outOfScope: 'B2. Out of Scope',
  assumptions: 'B3. Assumptions, Constraints, and Dependencies',
  background: 'C1. Current Environment',
  volumes: 'C2. Volumes and Scale',
  deliverables: 'D1. Deliverables',
  acceptance: 'D2. Acceptance Criteria',
  timeline: 'D3. Milestones and Timeline',
  functional: 'G1. Functional Requirements',
  nonFunctional: 'G2. Non-Functional Requirements',
  compliance: 'I. Compliance, Privacy, and Security',
  logistics: 'J. Locations and Logistics',
  openQuestions: 'Open Questions and Assumptions',
};
