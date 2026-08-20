# Release checklist

## Automated gates

- [ ] Clean `npm ci`
- [ ] `npm run format:check`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run test:e2e`
- [ ] GitHub Actions quality and smoke jobs pass on the release commit
- [ ] Dependency audit reports no unresolved production vulnerability
- [ ] Secret scan finds no credential values

## Service configuration

- [ ] Production Clerk tenant authorized and public sign-up disabled
- [ ] Production Convex deployment authorized and variables verified
- [ ] First Overlord reconciled and concealment manually verified
- [ ] GitHub required checks enabled
- [ ] Vercel project connected and production variables verified
- [ ] Clerk webhook and redirects use production domains
- [ ] `ALLOW_DEVELOPMENT_RESET` absent/false in preview and production
- [ ] Backup/export and restoration procedure tested

## Required manual journeys

- [ ] Invite and activate one user for every visible role
- [ ] Confirm public sign-up is unavailable
- [ ] Confirm non-Overlord users cannot discover the Overlord
- [ ] Submit compliant multi-item Food Delivery order with images
- [ ] Submit late Event Purchase order and approve exception
- [ ] Attempt a simultaneous claim with two agents
- [ ] Release and reassign with reasons
- [ ] Request and answer additional information
- [ ] Purchase from two vendors with separate receipts
- [ ] Mark one item unavailable and verify partial fulfillment
- [ ] Receive items through reception
- [ ] Report an incorrect or damaged item
- [ ] Confirm receipt and complete an order
- [ ] Request a material change after assignment
- [ ] Cancel after purchase and resolve financial outcomes
- [ ] Compare an Admin export with source orders
- [ ] Deactivate a user and confirm access removal/history retention
- [ ] Manipulate URLs and client requests; protected actions must fail

## Accessibility and devices

- [ ] Keyboard-only navigation and visible focus checked
- [ ] Screen-reader labels and route/status announcements checked
- [ ] Error recovery and loading states checked
- [ ] Contrast reviewed at WCAG AA target
- [ ] 360 px mobile, tablet, and desktop critical flows checked
- [ ] Reduced-motion preference checked

## Release decision

- [ ] Known limitations accepted by owner
- [ ] Rollback operator and last known-good deployment identified
- [ ] Release report recommendation is GO
- [ ] Owner approves production promotion
