# QA Checklist – Phase 5
- [ ] Navigator loads same-origin demo page in iframe mode without console errors.
- [ ] Blocked iframe shows explanatory message and suggests reader/proxy fallback.
- [ ] Reader mode sanitizes script tags and inline event handlers.
- [ ] Proxy mode requires explicit URL configuration and warns about privacy.
- [ ] Bookmarks can be added/removed; selecting bookmark loads page.
- [ ] Downloads save to VFS and appear in Explorer with metadata.
- [ ] View Source shows sanitized HTML and allows copy.
- [ ] Dependency lint confirms Navigator only imports approved network/UI services.
