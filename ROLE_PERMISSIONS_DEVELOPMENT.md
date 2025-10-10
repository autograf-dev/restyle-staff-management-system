# Role Permissions Development Guide

## Overview
This document outlines the current role system and provides guidance for implementing granular permissions for the newly added Owner and HQ roles.

## Current Role System

### Existing Roles
- **Admin**: Full system access (original role)
- **Barber**: Limited access to main team only
- **Manager**: Limited access (existing role)

### Newly Added Roles
- **Owner**: Currently has same permissions as Admin
- **HQ**: Currently has same permissions as Admin

## Current Implementation Status

### ✅ Completed
1. **Role Types Updated**: Added "owner" and "hq" to UserRole type definitions
2. **Teams Page Updated**: Both Add User and Edit User dialogs now include Owner and HQ options
3. **Role Guard Updated**: Owner and HQ roles have same access as Admin
4. **User Context Updated**: Owner and HQ have access to all teams
5. **Badge Styling**: Owner and HQ roles display with default badge variant (same as Admin)

### 🔄 Temporary Implementation
Currently, Owner and HQ roles have identical permissions to Admin role. This is intentional for the initial implementation.

## Next Development Phase: Granular Permissions

### Required Tasks

#### 1. Define Permission Structure
Create a comprehensive permission system that allows different access levels for Owner and HQ roles.

**Suggested Permission Categories:**
- **User Management**: Create, edit, delete users
- **Team Management**: Access to different teams/locations
- **Financial Data**: View revenue, payments, transactions
- **Appointment Management**: View, create, edit, cancel appointments
- **Settings Management**: Modify system settings
- **Reporting**: Access to various reports and analytics

#### 2. Database Schema Updates
Consider adding a permissions table or extending user metadata to store granular permissions:

```sql
-- Option 1: Permissions table
CREATE TABLE user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  permission_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(100), -- Optional: for resource-specific permissions
  granted BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Option 2: JSON permissions in user metadata
-- Add permissions JSON field to user_metadata
```

#### 3. Permission Management UI
Create interfaces for:
- **Permission Assignment**: Allow admins to assign specific permissions to Owner/HQ users
- **Permission Templates**: Pre-defined permission sets for common role configurations
- **Permission Audit**: Track permission changes and access logs

#### 4. Implementation Files to Modify

**Core Files:**
- `src/contexts/user-context.tsx` - Add permission checking functions
- `src/components/role-guard.tsx` - Update to check specific permissions
- `src/app/teams/page.tsx` - Add permission management interface

**New Files to Create:**
- `src/types/permissions.ts` - Permission type definitions
- `src/hooks/use-permissions.ts` - Permission checking hook
- `src/components/permission-guard.tsx` - Component for permission-based rendering
- `src/app/teams/permissions/page.tsx` - Permission management page

#### 5. Suggested Permission Levels

**Owner Role Permissions:**
- Full access to all features
- Can manage other Owner and HQ users
- Can modify system-wide settings
- Access to all financial data across all locations

**HQ Role Permissions:**
- Access to multiple locations (configurable)
- View financial data for assigned locations
- Manage Barber users
- Limited system settings access
- Cannot manage other Owner/HQ users

**Admin Role Permissions:**
- Full access (maintain current functionality)
- Can manage all user types
- Full system access

**Barber Role Permissions:**
- Limited to assigned location
- View own appointments and customers
- No financial data access
- No user management

#### 6. Implementation Steps

1. **Phase 1**: Create permission type definitions and database schema
2. **Phase 2**: Implement permission checking functions in user context
3. **Phase 3**: Update role guard to use granular permissions
4. **Phase 4**: Create permission management UI
5. **Phase 5**: Update all protected routes to use new permission system
6. **Phase 6**: Add permission audit logging

#### 7. Testing Considerations

- Test permission inheritance and overrides
- Verify role-based access to different features
- Test permission changes in real-time
- Ensure backward compatibility with existing Admin users

## Current Code Locations

### Modified Files
- `src/app/teams/page.tsx` - Teams management with new roles
- `src/contexts/user-context.tsx` - User context with new role types
- `src/components/role-guard.tsx` - Role-based access control

### Key Functions to Extend
- `hasAccessToTeam()` in user-context.tsx
- `hasRole()` in user-context.tsx
- Role checking logic in role-guard.tsx

## Notes for Developer

1. **Backward Compatibility**: Ensure existing Admin users continue to work without changes
2. **Default Permissions**: Consider what default permissions new Owner/HQ users should have
3. **Migration Strategy**: Plan how to migrate existing users to the new permission system
4. **Performance**: Consider caching permissions to avoid repeated database queries
5. **Security**: Ensure permission checks are performed on both client and server side

## Contact
For questions about the current implementation or clarification on requirements, refer to the existing codebase and this documentation.
