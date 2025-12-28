# HQ Console Implementation Plan

## Overview
This document outlines the implementation plan for the comprehensive HQ Console features that link to Franchise POS systems.

## Phase 1: Database Schema ✅
- [x] Created schema extensions file (schema-hq-extensions.prisma)
- [ ] Integrate enums into main schema
- [ ] Integrate models into main schema
- [ ] Update existing models with new relations
- [ ] Run migration

## Phase 2: Core API Routes
- [ ] Enhanced HQ Dashboard API (with alerts, procurement vs sales, yield loss)
- [ ] Franchise Management API (onboarding, config, status)
- [ ] Central Procurement API (suppliers, PO, inward stock, allocation)
- [ ] Product Master API (chicken-specific with yield/wastage)
- [ ] Pricing & Standardization API
- [ ] Royalty & Margin Engine API
- [ ] Compliance & Hygiene API
- [ ] Analytics & Benchmarking API
- [ ] Alerts API

## Phase 3: UI Components
- [ ] Enhanced HQ Dashboard page
- [ ] Franchise Management page with onboarding wizard
- [ ] Central Procurement module pages
- [ ] Product Master management
- [ ] Pricing & Standardization interface
- [ ] Royalty & Margin dashboard
- [ ] Compliance & Hygiene tracking
- [ ] Analytics & Benchmarking dashboard

## Phase 4: Integration
- [ ] Link HQ features to Franchise POS data
- [ ] Real-time sync for alerts
- [ ] Data aggregation from franchises
- [ ] Cross-system reporting

## Priority Features (MVP)
1. Enhanced HQ Dashboard with alerts
2. Franchise Management with basic onboarding
3. Central Procurement (basic flow)
4. Product Master (chicken-specific)
5. Pricing & Standardization (basic)
6. Royalty calculation (basic)
7. Compliance tracking (basic)
8. Analytics dashboard

