import { getContext } from '@microsoft/power-apps/app'
import { MemberTCCDService } from './generated'
import type { MemberTCCDRead } from './generated/models/MemberTCCDModel'
import { withPowerAppsTimeout } from './powerAppsData'

export type AdminRole = 'ADMIN' | 'SUPERADMIN'

export type AdminUser = {
  name: string
  email: string
  claims: string
  role: AdminRole
}

export async function getCurrentAdminUser() {
  const contextUser = await getCurrentPowerAppsUser()
  const memberRows = await getMemberRows()
  const currentMember = findCurrentMember(memberRows, contextUser.email, contextUser.claims)

  if (!currentMember) {
    throw new Error('User tidak terdaftar di SharePoint list MemberTCCD.')
  }

  const role = normalizeAdminRole(currentMember.ROLES)

  if (!role) {
    throw new Error('User terdaftar di MemberTCCD, tetapi role bukan ADMIN atau SUPERADMIN.')
  }

  return {
    user: {
      ...contextUser,
      name: currentMember.PIC_TCCD?.DisplayName || contextUser.name,
      role,
    },
    members: memberRows,
  }
}

export async function canCurrentUserOpenAdminPortal() {
  try {
    await getCurrentAdminUser()
    return true
  } catch {
    return false
  }
}

async function getCurrentPowerAppsUser() {
  try {
    const context = await Promise.race([getContext(), timeoutAfter(2500)])
    const email = context?.user?.userPrincipalName?.trim().toLowerCase()

    if (email) {
      return {
        name: context.user.fullName?.trim() || email.split('@')[0].replace(/[._-]+/g, ' '),
        email,
        claims: `i:0#.f|membership|${email}`,
      }
    }
  } catch {
    // Mobile player fallback
  }

  throw new Error('User login Power Apps tidak ditemukan. Buka aplikasi melalui Power Apps local play.')
}

async function getMemberRows() {
  const result = await withPowerAppsTimeout(
    MemberTCCDService.getAll({
      select: ['ID', 'Title', 'PIC_TCCD', 'PIC_TCCD#Claims', 'ROLES'],
      top: 500,
      orderBy: ['ID asc'],
    }),
  )

  return Array.isArray(result.data) ? result.data : []
}

function findCurrentMember(memberRows: MemberTCCDRead[], email: string, claims: string) {
  const normalizedEmail = email.toLowerCase()
  const normalizedClaims = claims.toLowerCase()

  return memberRows.find((member) => {
    const memberEmail = cleanText(member.PIC_TCCD?.Email).toLowerCase()
    const memberClaims = cleanText(member['PIC_TCCD#Claims']).toLowerCase()
    return memberEmail === normalizedEmail || memberClaims === normalizedClaims
  })
}

export function normalizeAdminRole(role?: string | null): AdminRole | null {
  const normalizedRole = cleanText(role).toUpperCase()

  if (normalizedRole === 'ADMIN' || normalizedRole === 'SUPERADMIN') {
    return normalizedRole
  }

  return null
}

function cleanText(value?: string | null) {
  return value?.trim() ?? ''
}

function timeoutAfter(timeoutMs: number) {
  return new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('Power Apps user context timeout.')), timeoutMs)
  })
}
