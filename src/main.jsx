import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useSearchParams
} from 'react-router-dom';
import {
  Activity,
  Bell,
  Building2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  FileText,
  HeartPulse,
  Home,
  Hospital,
  LogOut,
  Plus,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  UserRound,
  UsersRound
} from 'lucide-react';
import { api, clearSession, getStoredUser, setSession } from './api/client.js';
import { SimpleBarChart } from './components/SimpleBarChart.jsx';
import './styles/app.css';

const ROLES = {
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  ORG_ADMIN: 'ORG_ADMIN',
  NGO_SOCIAL_WORKER: 'NGO_SOCIAL_WORKER',
  HOSPITAL_RECORDS_KEEPER: 'HOSPITAL_RECORDS_KEEPER'
};

const roleLabels = {
  PLATFORM_ADMIN: 'Platform Administrator',
  ORG_ADMIN: 'Organisation Administrator',
  NGO_SOCIAL_WORKER: 'NGO Social Worker',
  HOSPITAL_RECORDS_KEEPER: 'Hospital Records Keeper'
};

const statusClass = {
  Pending: 'status pending',
  Accepted: 'status accepted',
  'In Progress': 'status progress',
  Completed: 'status completed',
  Rejected: 'status rejected',
  Cancelled: 'status rejected',
  ACTIVE: 'status completed',
  INACTIVE: 'status rejected',
  ARCHIVED: 'status pending'
};

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'organisations', label: 'Organisations', icon: Building2, roles: [ROLES.PLATFORM_ADMIN] },
  { id: 'organisation-admins', label: 'Organisation Admins', icon: UserCog, roles: [ROLES.PLATFORM_ADMIN] },
  { id: 'service-categories', label: 'Service Categories', icon: SlidersHorizontal, roles: [ROLES.PLATFORM_ADMIN] },
  { id: 'audit-logs', label: 'Audit Logs', icon: FileText, roles: [ROLES.PLATFORM_ADMIN] },
  { id: 'active-users', label: 'Active Users', icon: UsersRound, roles: [ROLES.PLATFORM_ADMIN] },
  { id: 'staff-users', label: 'Staff Users', icon: UsersRound, roles: [ROLES.ORG_ADMIN] },
  { id: 'referrals', label: 'Referrals', icon: ClipboardList, roles: [ROLES.ORG_ADMIN, ROLES.NGO_SOCIAL_WORKER, ROLES.HOSPITAL_RECORDS_KEEPER] },
  { id: 'new-referral', label: 'New Referral', icon: Plus, roles: [ROLES.NGO_SOCIAL_WORKER] },
  { id: 'hospital-inbox', label: 'Hospital Inbox', icon: Hospital, roles: [ROLES.HOSPITAL_RECORDS_KEEPER] },
  { id: 'beneficiaries', label: 'Case Profiles', icon: UsersRound, roles: [ROLES.NGO_SOCIAL_WORKER] },
  { id: 'feedback', label: 'Feedback', icon: Send, roles: [ROLES.NGO_SOCIAL_WORKER, ROLES.HOSPITAL_RECORDS_KEEPER] },
  { id: 'reports', label: 'Reports', icon: FileText, roles: [ROLES.PLATFORM_ADMIN, ROLES.ORG_ADMIN, ROLES.NGO_SOCIAL_WORKER, ROLES.HOSPITAL_RECORDS_KEEPER] },
  { id: 'profile', label: 'Profile', icon: UserRound, roles: [ROLES.ORG_ADMIN, ROLES.NGO_SOCIAL_WORKER, ROLES.HOSPITAL_RECORDS_KEEPER] }
];

const roleBasePaths = {
  [ROLES.PLATFORM_ADMIN]: '/platform',
  [ROLES.ORG_ADMIN]: '/org-admin',
  [ROLES.NGO_SOCIAL_WORKER]: '/ngo',
  [ROLES.HOSPITAL_RECORDS_KEEPER]: '/hospital'
};

const routeSegments = {
  [ROLES.PLATFORM_ADMIN]: {
    dashboard: 'dashboard',
    organisations: 'organisations',
    'organisation-admins': 'organisation-admins',
    'service-categories': 'service-categories',
    'audit-logs': 'audit-logs',
    'active-users': 'active-users',
    reports: 'reports'
  },
  [ROLES.ORG_ADMIN]: {
    dashboard: 'dashboard',
    'staff-users': 'staff-users',
    referrals: 'referrals',
    reports: 'reports',
    profile: 'profile'
  },
  [ROLES.NGO_SOCIAL_WORKER]: {
    dashboard: 'dashboard',
    referrals: 'referrals',
    'new-referral': 'new-referral',
    beneficiaries: 'case-profiles',
    feedback: 'feedback',
    reports: 'reports',
    profile: 'profile'
  },
  [ROLES.HOSPITAL_RECORDS_KEEPER]: {
    dashboard: 'dashboard',
    'hospital-inbox': 'inbox',
    referrals: 'referrals',
    feedback: 'feedback',
    reports: 'reports',
    profile: 'profile'
  }
};

function isAllowedView(viewId, user) {
  if (!user) return false;
  return Boolean(routeSegments[user.role]?.[viewId]);
}

function routeForView(viewId, user) {
  const basePath = roleBasePaths[user?.role] || '/login';
  const segment = routeSegments[user?.role]?.[viewId] || routeSegments[user?.role]?.dashboard;
  return `${basePath}/${segment || 'dashboard'}`;
}

function dashboardPathForUser(user) {
  return routeForView('dashboard', user);
}

function useExclusiveExpansion(initialPanel) {
  const [expandedPanel, setExpandedPanel] = useState(initialPanel);

  // Keeps only one panel open; optional fallback opens another panel when the current one is clicked again.
  function togglePanel(panelId, fallbackPanel = null) {
    setExpandedPanel((current) => (current === panelId ? fallbackPanel : panelId));
  }

  return { expandedPanel, togglePanel };
}

function CollapsiblePanel({ id, title, summary, expandedPanel, onToggle, fallbackPanel, children }) {
  const isExpanded = expandedPanel === id;
  const Icon = isExpanded ? ChevronDown : ChevronRight;

  return (
    <section className="panel collapsible-panel">
      <button className="collapsible-toggle" type="button" onClick={() => onToggle(id, fallbackPanel)} aria-expanded={isExpanded}>
        <span>
          <strong>{title}</strong>
          {summary && <small>{summary}</small>}
        </span>
        <Icon size={18} aria-hidden="true" />
      </button>
      {isExpanded && <div className="collapsible-body">{children}</div>}
    </section>
  );
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : 'Not available';
}

function getEmailDomain(value) {
  const parts = String(value || '').trim().toLowerCase().split('@');
  return parts.length === 2 ? parts[1] : '';
}

function emptyData() {
  return {
    dashboard: null,
    referrals: [],
    beneficiaries: [],
    lookups: { organisations: [], ngos: [], hospitals: [], roles: [], organisationRoles: [], statuses: [], urgencyLevels: [] },
    reports: null,
    reportOptions: { reports: [], output_formats: [] },
    admin: {
      organisations: [],
      organisationAdmins: [],
      staff: [],
      serviceCategories: [],
      referralCategories: [],
      auditLogs: [],
      systemStatistics: null,
      activeUsers: [],
      organisationProfile: null
    }
  };
}

function useAppData(user) {
  const [data, setData] = useState(emptyData());
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');

  async function refresh() {
    if (!user) return;
    setLoading(true);
    try {
      const next = emptyData();
      const [dashboard, lookups, reports, reportOptions] = await Promise.all([
        api('/dashboard'),
        api('/lookups'),
        api('/reports/summary'),
        api('/reports/available')
      ]);
      next.dashboard = dashboard;
      next.lookups = lookups;
      next.reports = reports;
      next.reportOptions = reportOptions;

      if (user.role === ROLES.PLATFORM_ADMIN) {
        const [organisations, organisationAdmins, categories, auditLogs, systemStatistics, activeUsers] = await Promise.all([
          api('/admin/organisations'),
          api('/admin/organisation-admins'),
          api('/admin/service-categories'),
          api('/admin/audit-logs'),
          api('/admin/system-statistics'),
          api('/admin/active-users')
        ]);
        next.admin.organisations = organisations.organisations;
        next.admin.organisationAdmins = organisationAdmins.admins;
        next.admin.serviceCategories = categories.serviceCategories;
        next.admin.referralCategories = categories.referralCategories;
        next.admin.auditLogs = auditLogs.logs;
        next.admin.systemStatistics = systemStatistics;
        next.admin.activeUsers = activeUsers.organisations;
      }

      if (user.role === ROLES.ORG_ADMIN) {
        const [staff, profile] = await Promise.all([
          api('/admin/staff'),
          api('/admin/organisation-profile')
        ]);
        next.admin.staff = staff.staff;
        next.admin.organisationProfile = profile.organisation;
      }

      if ([ROLES.NGO_SOCIAL_WORKER, ROLES.HOSPITAL_RECORDS_KEEPER].includes(user.role)) {
        const [referrals] = await Promise.all([api('/referrals')]);
        next.referrals = referrals.referrals;
      }

      if (user.role === ROLES.NGO_SOCIAL_WORKER) {
        const beneficiaries = await api('/beneficiaries');
        next.beneficiaries = beneficiaries.beneficiaries;
      }

      setData(next);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [user?.id]);

  function removeNotification(notificationId) {
    setData((current) => ({
      ...current,
      dashboard: current.dashboard ? {
        ...current.dashboard,
        notifications: (current.dashboard.notifications || []).filter((notification) => notification.id !== notificationId)
      } : current.dashboard
    }));
  }

  return { data, loading, notice, setNotice, refresh, removeNotification };
}

function Login({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = await api('/auth/login', { method: 'POST', body: form });
      setSession(payload.token, payload.user);
      onLogin(payload.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand-mark"><HeartPulse size={30} aria-hidden="true" /></div>
        <h1>ReferralLink</h1>
        <p>Feedback and referral tracking for NGOs and hospitals.</p>
        <form onSubmit={submit} className="stack">
          <label>Email<input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>Password<input type="password" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
          {error && <div className="alert error">{error}</div>}
          <button className="primary" type="submit" disabled={busy}><ShieldCheck size={18} aria-hidden="true" />{busy ? 'Signing in...' : 'Sign in'}</button>
        </form>
      </section>
    </main>
  );
}

function Shell({ user, onLogout, notice, setNotice, loading }) {
  const allowedNav = navItems.filter((item) => !item.roles || item.roles.includes(user.role));
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="app-logo"><HeartPulse size={24} aria-hidden="true" /><span>ReferralLink</span></div>
        <nav>
          {allowedNav.map((item) => {
            const Icon = item.icon;
            return <NavLink key={item.id} className={({ isActive }) => isActive ? 'nav active' : 'nav'} to={routeForView(item.id, user)}><Icon size={18} aria-hidden="true" /><span>{item.label}</span></NavLink>;
          })}
        </nav>
        <button className="nav logout" onClick={onLogout}><LogOut size={18} aria-hidden="true" /><span>Logout</span></button>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div><p>{roleLabels[user.role]}</p><h2>{user.full_name}</h2></div>
          <div className="org-pill"><UserRound size={18} aria-hidden="true" /><span>{user.organisation_name || 'Platform governance'}</span></div>
        </header>
        {notice && <button className="toast" onClick={() => setNotice('')}>{notice}</button>}
        {loading && <div className="loading">Loading latest records...</div>}
        <Outlet />
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon, tone, onClick }) {
  const className = `metric ${tone || ''} ${onClick ? 'interactive' : ''}`;
  if (onClick) {
    return <button className={className} type="button" onClick={onClick}><Icon size={22} aria-hidden="true" /><span><strong>{value}</strong><span>{label}</span></span></button>;
  }

  return <article className={className}><Icon size={22} aria-hidden="true" /><div><strong>{value}</strong><span>{label}</span></div></article>;
}

function Dashboard({ dashboard, onNavigate, onAttendNotification, user, loading }) {
  const statusRows = dashboard?.metrics?.byStatus || [];
  const mode = dashboard?.mode || 'operational';
  const isHospitalDashboard = user?.role === ROLES.HOSPITAL_RECORDS_KEEPER;
  const isNgoDashboard = user?.role === ROLES.NGO_SOCIAL_WORKER;
  const notificationTarget = isHospitalDashboard ? 'hospital-inbox' : isNgoDashboard ? 'feedback' : null;
  return (
    <section className="page">
      <div className="title-row"><div><h1>{mode === 'platform' ? 'Platform Dashboard' : mode === 'organisation' ? 'Organisation Dashboard' : 'Referral Dashboard'}</h1></div></div>
      {mode === 'platform' && (
        <>
          <div className="metrics-grid">
            <Metric label="Organisations" value={dashboard.metrics.totalOrganisations || 0} icon={Building2} />
            <Metric label="Active users" value={dashboard.metrics.activeUsers || 0} icon={UsersRound} tone="cool" />
            <Metric label="Total referrals" value={dashboard.metrics.totalReferrals || 0} icon={ClipboardList} tone="warm" />
          </div>
          <div className="management-grid">
            <ManagementCard icon={Building2} title="Organisations" text="Add, edit, deactivate, and archive NGOs and hospitals." onClick={() => onNavigate('organisations')} />
            <ManagementCard icon={UserCog} title="Organisation admins" text="Create the first administrator account for each organisation." onClick={() => onNavigate('organisation-admins')} />
            <ManagementCard icon={UsersRound} title="Active users" text="View active user counts grouped by organisation." onClick={() => onNavigate('active-users')} />
            <ManagementCard icon={SlidersHorizontal} title="Service categories" text="Manage referral service types used across the platform." onClick={() => onNavigate('service-categories')} />
            <ManagementCard icon={FileText} title="Audit logs" text="Review system access and administrative actions." onClick={() => onNavigate('audit-logs')} />
          </div>
          <section className="panel">
            <h3>Active users by organisation</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Organisation</th><th>Type</th><th>Status</th><th>Active users</th></tr></thead>
                <tbody>{(dashboard.activeUsersByOrganisation || []).map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.type}</td><td><span className={statusClass[row.status] || 'status'}>{row.status}</span></td><td>{row.active_users}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {mode === 'organisation' && (
        <div className="metrics-grid">
          <Metric label="Staff users" value={dashboard.metrics.staffUsers || 0} icon={UsersRound} />
          <Metric label="Referrals sent" value={dashboard.metrics.referralsSent || 0} icon={ClipboardList} tone="cool" />
          <Metric label="Referrals received" value={dashboard.metrics.referralsReceived || 0} icon={Hospital} tone="warm" />
        </div>
      )}
      {mode === 'operational' && (
        <>
          <div className="metrics-grid">
            <Metric label="Total referrals" value={dashboard?.metrics?.totalReferrals || 0} icon={ClipboardList} onClick={isHospitalDashboard || isNgoDashboard ? () => onNavigate('referrals') : null} />
            <Metric label="Urgent open cases" value={dashboard?.metrics?.urgentOpen || 0} icon={Activity} tone="warm" onClick={isHospitalDashboard ? () => onNavigate('hospital-inbox') : isNgoDashboard ? () => onNavigate('referrals') : null} />
            <Metric label="Pending feedback" value={dashboard?.metrics?.pendingFeedback || 0} icon={Bell} tone="cool" onClick={isHospitalDashboard || isNgoDashboard ? () => onNavigate('feedback') : null} />
            <Metric label="Completed" value={statusRows.find((row) => row.status === 'Completed')?.total || 0} icon={CheckCircle2} tone="good" onClick={isHospitalDashboard ? () => onNavigate('referrals') : isNgoDashboard ? () => onNavigate('feedback') : null} />
          </div>
          <div className="content-grid">
            <RecentReferralsPanel referrals={dashboard?.recent || []} loading={loading} onShowMore={() => onNavigate('referrals')} />
            <NotificationPanel notifications={dashboard?.notifications || []} onAttend={onAttendNotification} onOpen={notificationTarget ? () => onNavigate(notificationTarget) : null} />
          </div>
        </>
      )}
    </section>
  );
}

function ManagementCard({ icon: Icon, title, text, onClick }) {
  return <button className="management-card" type="button" onClick={onClick}><Icon size={22} aria-hidden="true" /><span><strong>{title}</strong><p>{text}</p></span></button>;
}

function RecentReferralsPanel({ referrals, loading, onShowMore }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h3>Recent referrals</h3>
        <button type="button" onClick={onShowMore}>Show More</button>
      </div>
      {loading && !referrals.length ? <div className="empty">Loading recent referrals...</div> : (
        <div className="recent-list">
          {referrals.map((referral) => (
            <article className="recent-item" key={referral.id}>
              <div>
                <strong>{referral.beneficiary_name || referral.referral_number}</strong>
                <p>{referral.referral_number} from {referral.ngo_name || 'Unknown organisation'}</p>
              </div>
              <div>
                <span className={statusClass[referral.status] || 'status'}>{referral.status}</span>
                <small>Received {formatDate(referral.created_at || referral.updated_at)}</small>
              </div>
            </article>
          ))}
          {!referrals.length && <div className="empty">No recent referrals found.</div>}
        </div>
      )}
    </section>
  );
}

function NotificationPanel({ notifications, onAttend, onOpen }) {
  const unreadNotifications = notifications.filter((notification) => !notification.is_read);
  const unreadCount = unreadNotifications.length;
  const countLabel = `${unreadCount} notification${unreadCount === 1 ? '' : 's'}`;

  async function attendNotification(event, notification) {
    event.stopPropagation();
    if (onAttend) {
      const attended = await onAttend(notification.id);
      if (!attended) return;
    }
    if (onOpen) onOpen();
  }

  const content = (
    <>
      <div className="panel-heading">
        <h3>Notifications</h3>
        <span className="notification-count">{countLabel}</span>
      </div>
      <div className="notice-list">
        {unreadNotifications.map((notification) => <button key={notification.id} type="button" className="notice-item" onClick={(event) => attendNotification(event, notification)}><Bell size={16} aria-hidden="true" /><span><strong>{notification.title}</strong><p>{notification.message}</p></span></button>)}
        {!unreadNotifications.length && <div className="empty">No new notifications.</div>}
      </div>
    </>
  );

  if (onOpen) {
    return <section className="panel notification-panel shortcut-card" role="button" tabIndex="0" onClick={onOpen} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onOpen(); }}>{content}</section>;
  }

  return (
    <section className="panel notification-panel">{content}</section>
  );
}

function ReferralTable({ referrals, compact, hideHospital = false, hideOrganisation = false, organisationLabel = 'Organisation', hospitalLabel = 'Hospital' }) {
  const colSpan = 2 + (!compact && !hideOrganisation ? 1 : 0) + (hideHospital ? 0 : 1) + 2 + (!compact ? 1 : 0);
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Reference</th><th>Beneficiary</th>{!compact && !hideOrganisation && <th>{organisationLabel}</th>}{!hideHospital && <th>{hospitalLabel}</th>}<th>Urgency</th><th>Status</th>{!compact && <th>Service</th>}</tr></thead>
        <tbody>
          {referrals.map((referral) => (
            <tr key={referral.id}>
              <td>{referral.referral_number}</td><td>{referral.beneficiary_name}</td>{!compact && !hideOrganisation && <td>{referral.ngo_name}</td>}{!hideHospital && <td>{referral.hospital_name}</td>}<td>{referral.urgency}</td><td><span className={statusClass[referral.status] || 'status'}>{referral.status}</span></td>{!compact && <td>{referral.service_required}</td>}
            </tr>
          ))}
          {!referrals.length && <tr><td colSpan={colSpan} className="empty">No referrals found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

const emptyOrganisationAdminForm = {
  id: '',
  name: '',
  type: 'NGO',
  email_domain: '',
  email: '',
  phone: '',
  location: '',
  status: 'ACTIVE',
  admin_id: '',
  admin_full_name: '',
  admin_email: '',
  admin_password: '',
  admin_status: 'ACTIVE'
};

function Organisations({ organisations, admins, refresh, setNotice }) {
  const { expandedPanel, togglePanel } = useExclusiveExpansion('directory');
  const [searchParams, setSearchParams] = useSearchParams();
  const [form, setForm] = useState(emptyOrganisationAdminForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const editOrganisationId = searchParams.get('editOrganisationId');
  const isEditing = Boolean(form.id);

  function adminForOrganisation(organisationId) {
    return admins.find((admin) => Number(admin.organisation_id) === Number(organisationId));
  }

  function resetForm() {
    setForm(emptyOrganisationAdminForm);
    setError('');
    setSearchParams({});
  }

  function loadOrganisation(organisation) {
    const linkedAdmin = adminForOrganisation(organisation.id);
    setForm({
      id: organisation.id,
      name: organisation.name || '',
      type: organisation.type || 'NGO',
      email_domain: getEmailDomain(organisation.email),
      email: organisation.email || '',
      phone: organisation.phone || '',
      location: organisation.location || '',
      status: organisation.status || 'ACTIVE',
      admin_id: linkedAdmin?.id || '',
      admin_full_name: linkedAdmin?.full_name || '',
      admin_email: linkedAdmin?.email || '',
      admin_password: '',
      admin_status: linkedAdmin?.status || 'ACTIVE'
    });
    setError('');
    togglePanel('add');
    setSearchParams({ editOrganisationId: String(organisation.id) });
  }

  useEffect(() => {
    if (!editOrganisationId || !organisations.length) return;
    const organisation = organisations.find((item) => Number(item.id) === Number(editOrganisationId));
    if (organisation) loadOrganisation(organisation);
  }, [editOrganisationId, organisations.length, admins.length]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const path = isEditing ? `/admin/organisations/${form.id}/with-admin` : '/admin/organisations-with-admin';
      await api(path, { method: isEditing ? 'PATCH' : 'POST', body: form });
      setNotice(isEditing ? 'Organisation and administrator updated.' : 'Organisation and administrator created.');
      resetForm();
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="page">
      <h1>Organisations</h1>
      <div className="accordion-stack">
        <CollapsiblePanel id="add" title={isEditing ? 'Edit organisation' : 'Add organisation'} summary={isEditing ? 'Update organisation and linked administrator' : 'Create an organisation and its administrator'} expandedPanel={expandedPanel} onToggle={togglePanel} fallbackPanel="directory">
          <form className="form-grid" onSubmit={submit}>
            <h3 className="wide">Organisation Details</h3>
            <label>Organisation name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label>Organisation type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>NGO</option><option>HOSPITAL</option></select></label>
            <label>Email domain<input required placeholder="example.org" value={form.email_domain} onChange={(event) => setForm({ ...form, email_domain: event.target.value })} /></label>
            <label>Contact email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label>Phone number<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
            <label>Location/address<input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
            <label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>ACTIVE</option><option>INACTIVE</option><option>ARCHIVED</option></select></label>
            <h3 className="wide">Organisation Administrator Details</h3>
            <label>Full name<input required value={form.admin_full_name} onChange={(event) => setForm({ ...form, admin_full_name: event.target.value })} /></label>
            <label>Email<input required type="email" value={form.admin_email} onChange={(event) => setForm({ ...form, admin_email: event.target.value })} /></label>
            <label>Password<input required={!form.admin_id} type="password" placeholder={form.admin_id ? 'Leave blank to keep current password' : ''} value={form.admin_password} onChange={(event) => setForm({ ...form, admin_password: event.target.value })} /></label>
            <label>Administrator status<select value={form.admin_status} onChange={(event) => setForm({ ...form, admin_status: event.target.value })}><option>ACTIVE</option><option>INACTIVE</option></select></label>
            {error && <div className="alert error wide">{error}</div>}
            <div className="button-row wide">
              <button className="primary" type="submit" disabled={saving}><Plus size={18} aria-hidden="true" />{saving ? 'Saving...' : isEditing ? 'Save changes' : 'Add organisation'}</button>
              {isEditing && <button type="button" onClick={resetForm}>Cancel</button>}
            </div>
          </form>
        </CollapsiblePanel>
        <CollapsiblePanel id="directory" title="Directory" summary={`${organisations.length} organisation${organisations.length === 1 ? '' : 's'}`} expandedPanel={expandedPanel} onToggle={togglePanel} fallbackPanel="add">
          <OrganisationTable organisations={organisations} onEdit={loadOrganisation} />
        </CollapsiblePanel>
      </div>
    </section>
  );
}

function OrganisationTable({ organisations, onEdit }) {
  return (
    <div className="table-wrap"><table><thead><tr><th>Name</th><th>Type</th><th>Email domain</th><th>Contact email</th><th>Location</th><th>Status</th><th className="control-col"></th></tr></thead><tbody>
      {organisations.map((organisation) => <tr key={organisation.id}><td>{organisation.name}</td><td>{organisation.type}</td><td>{getEmailDomain(organisation.email) || 'Not set'}</td><td>{organisation.email || 'Not set'}</td><td>{organisation.location || 'Not set'}</td><td><span className={statusClass[organisation.status] || 'status'}>{organisation.status}</span></td><td><button onClick={() => onEdit(organisation)}>Edit</button></td></tr>)}
      {!organisations.length && <tr><td colSpan="7" className="empty">No organisations have been added yet.</td></tr>}
    </tbody></table></div>
  );
}

function OrganisationAdmins({ admins, loading, user }) {
  const navigate = useNavigate();

  function editAdmin(admin) {
    navigate(`${routeForView('organisations', user)}?editOrganisationId=${admin.organisation_id}`);
  }

  return (
    <section className="page">
      <h1>Organisation Admins</h1>
      <section className="panel">
        <div className="panel-heading">
          <h3>Administrator directory</h3>
          <span>{admins.length} administrator{admins.length === 1 ? '' : 's'}</span>
        </div>
        {loading ? <div className="empty">Loading organisation administrators...</div> : <OrganisationAdminTable admins={admins} onEdit={editAdmin} />}
      </section>
    </section>
  );
}

function OrganisationAdminTable({ admins, onEdit }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Assigned organisation</th><th>Organisation type</th><th>Status</th><th>Date added</th><th className="control-col"></th></tr></thead>
        <tbody>
          {admins.map((admin) => <tr key={admin.id}><td>{admin.full_name}</td><td>{admin.email}</td><td>{admin.organisation_name}</td><td>{admin.organisation_type}</td><td><span className={statusClass[admin.status] || 'status'}>{admin.status}</span></td><td>{formatDate(admin.created_at)}</td><td><button onClick={() => onEdit(admin)}>Edit</button></td></tr>)}
          {!admins.length && <tr><td colSpan="7" className="empty">No organisation administrators have been added yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StaffUsers({ staff, user, loading, refresh, setNotice }) {
  const { expandedPanel, togglePanel } = useExclusiveExpansion('directory');
  const allowedRoles = user.organisation_type === 'NGO' ? [ROLES.ORG_ADMIN, ROLES.NGO_SOCIAL_WORKER] : [ROLES.ORG_ADMIN, ROLES.HOSPITAL_RECORDS_KEEPER];
  const [form, setForm] = useState({ full_name: '', email: '', password: 'password123', role: allowedRoles[1] || ROLES.ORG_ADMIN });
  async function submit(event) {
    event.preventDefault();
    await api('/admin/staff', { method: 'POST', body: form });
    setForm({ full_name: '', email: '', password: 'password123', role: allowedRoles[1] || ROLES.ORG_ADMIN });
    setNotice('Staff account created.');
    refresh();
  }
  async function toggleStaff(person) {
    await api(`/admin/staff/${person.id}`, { method: 'PATCH', body: { status: person.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } });
    refresh();
  }
  return (
    <section className="page">
      <h1>Staff Users</h1>
      <div className="accordion-stack">
        <CollapsiblePanel id="add" title="Add staff" summary={`Roles available for ${user.organisation_type || 'this organisation'}`} expandedPanel={expandedPanel} onToggle={togglePanel}>
          <form className="stack" onSubmit={submit}>
            <label>Full name<input required value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></label>
            <label>Email<input required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label>Password<input required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
            <label>Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>{allowedRoles.map((role) => <option key={role}>{role}</option>)}</select></label>
            <button className="primary" type="submit"><Plus size={18} aria-hidden="true" />Add staff</button>
          </form>
        </CollapsiblePanel>
        <CollapsiblePanel id="directory" title="Staff directory" summary={`${staff.length} user${staff.length === 1 ? '' : 's'} in your organisation`} expandedPanel={expandedPanel} onToggle={togglePanel}>
          {loading ? <div className="empty">Loading staff users...</div> : <StaffTable staff={staff} onToggleStaff={toggleStaff} />}
        </CollapsiblePanel>
      </div>
    </section>
  );
}

function StaffTable({ staff, onToggleStaff }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Date added</th><th>Actions</th></tr></thead>
        <tbody>
          {staff.map((person) => <tr key={person.id}><td>{person.full_name}</td><td>{person.email}</td><td>{person.role}</td><td><span className={statusClass[person.status] || 'status'}>{person.status}</span></td><td>{formatDate(person.created_at)}</td><td><button onClick={() => onToggleStaff(person)}>{person.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button></td></tr>)}
          {!staff.length && <tr><td colSpan="6" className="empty">No staff users have been added for your organisation yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function OrganisationProfile({ organisation, loading, refresh, setNotice }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: '', email: '', phone: '', location: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!organisation) return;
    setDraft({
      name: organisation.name || '',
      email: organisation.email || '',
      phone: organisation.phone || '',
      location: organisation.location || ''
    });
  }, [organisation?.id, organisation?.name, organisation?.email, organisation?.phone, organisation?.location]);

  function cancelEdit() {
    setError('');
    setEditing(false);
    setDraft({
      name: organisation?.name || '',
      email: organisation?.email || '',
      phone: organisation?.phone || '',
      location: organisation?.location || ''
    });
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!draft.name.trim()) {
      setError('Organisation name is required.');
      return;
    }

    if (!draft.email.trim()) {
      setError('Contact email is required.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await api('/admin/organisation-profile', { method: 'PATCH', body: draft });
      setNotice('Profile updated.');
      setEditing(false);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading && !organisation) {
    return <section className="page"><h1>Profile</h1><section className="panel"><div className="empty">Loading profile...</div></section></section>;
  }

  if (!organisation) {
    return <section className="page"><h1>Profile</h1><section className="panel"><div className="empty">No organisation profile was found.</div></section></section>;
  }

  return (
    <section className="page">
      <div className="title-row">
        <h1>Profile</h1>
        {!editing && <button className="primary" type="button" onClick={() => setEditing(true)}>Edit Profile</button>}
      </div>
      <section className="panel">
        {editing ? (
          <form className="form-grid" onSubmit={saveProfile}>
            <label>Name<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
            <label>Contact email<input type="email" required value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label>
            <label>Phone<input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></label>
            <label>Location<input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></label>
            {error && <div className="alert error wide">{error}</div>}
            <div className="button-row wide">
              <button className="primary" type="submit" disabled={busy || !draft.name.trim()}>{busy ? 'Saving...' : 'Save Changes'}</button>
              <button type="button" onClick={cancelEdit} disabled={busy}>Cancel</button>
            </div>
          </form>
        ) : (
          <div className="detail-grid">
            <div><span>Name</span><strong>{organisation.name}</strong></div>
            <div><span>Organisation type</span><strong>{organisation.type}</strong></div>
            <div><span>Contact email</span><strong>{organisation.email || 'Not set'}</strong></div>
            <div><span>Phone</span><strong>{organisation.phone || 'Not set'}</strong></div>
            <div><span>Location</span><strong>{organisation.location || 'Not set'}</strong></div>
            <div><span>Status</span><strong>{organisation.status}</strong></div>
          </div>
        )}
      </section>
    </section>
  );
}

function ServiceCategories({ categories, refresh, setNotice }) {
  const { expandedPanel, togglePanel } = useExclusiveExpansion('types');
  const [form, setForm] = useState({ name: '', description: '' });

  async function submit(event) {
    event.preventDefault();
    await api('/admin/service-categories', { method: 'POST', body: { ...form, is_active: true } });
    setForm({ name: '', description: '' });
    setNotice('Service category created.');
    refresh();
  }

  async function toggle(category) {
    await api(`/admin/service-categories/${category.id}`, { method: 'PATCH', body: { is_active: !category.is_active } });
    refresh();
  }

  return (
    <section className="page">
      <h1>Service Categories</h1>
      <div className="accordion-stack">
        <CollapsiblePanel id="add" title="Add referral service type" summary="Create a service option used in referrals" expandedPanel={expandedPanel} onToggle={togglePanel} fallbackPanel="types">
          <form className="stack" onSubmit={submit}>
            <label>Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label>Description<textarea rows="4" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
            <button className="primary" type="submit"><Plus size={18} aria-hidden="true" />Add service type</button>
          </form>
        </CollapsiblePanel>
        <CollapsiblePanel id="types" title="Service types" summary={`${categories.length} service type${categories.length === 1 ? '' : 's'}`} expandedPanel={expandedPanel} onToggle={togglePanel} fallbackPanel="add">
          <div className="table-wrap"><table><thead><tr><th>Name</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead><tbody>{categories.map((category) => <tr key={category.id}><td>{category.name}</td><td>{category.description}</td><td>{category.is_active ? <span className="status completed">Active</span> : <span className="status pending">Inactive</span>}</td><td><button onClick={() => toggle(category)}>{category.is_active ? 'Deactivate' : 'Activate'}</button></td></tr>)}{!categories.length && <tr><td colSpan="4" className="empty">No service types have been added yet.</td></tr>}</tbody></table></div>
        </CollapsiblePanel>
      </div>
    </section>
  );
}

function Referrals({ referrals, statuses, user }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const isHospitalUser = user.role === ROLES.HOSPITAL_RECORDS_KEEPER;
  const isNgoUser = user.role === ROLES.NGO_SOCIAL_WORKER;
  const filtered = referrals.filter((referral) => {
    const matchesSearch = `${referral.referral_number} ${referral.beneficiary_name} ${referral.status} ${referral.hospital_name} ${referral.ngo_name}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || referral.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <section className="page">
      <div className="title-row">
        <h1>Referral Tracking</h1>
        <div className="referral-tools">
          <div className="search-box"><Search size={17} aria-hidden="true" /><input placeholder="Search referrals" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Referral status filter"><option value="">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select>
        </div>
      </div>
      <section className="panel">
        <ReferralTable referrals={filtered} hideHospital={isHospitalUser} hideOrganisation={isNgoUser} organisationLabel={isHospitalUser ? 'Referred by' : 'Organisation'} hospitalLabel={isNgoUser ? 'Referred to' : 'Hospital'} />
      </section>
    </section>
  );
}

function NewReferral({ lookups, beneficiaries, refresh, setNotice }) {
  const [form, setForm] = useState({ beneficiary_id: '', receiving_organisation_id: '', service_required: '', urgency: 'Medium', reason: '' });
  async function submit(event) {
    event.preventDefault();
    await api('/referrals', { method: 'POST', body: form });
    setForm({ beneficiary_id: '', receiving_organisation_id: '', service_required: '', urgency: 'Medium', reason: '' });
    setNotice('Referral submitted.');
    refresh();
  }
  return (
    <section className="page"><h1>New Referral</h1><form className="panel form-grid" onSubmit={submit}>
      <label>Beneficiary<select required value={form.beneficiary_id} onChange={(event) => setForm({ ...form, beneficiary_id: event.target.value })}><option value="">Select beneficiary</option>{beneficiaries.map((item) => <option key={item.id} value={item.id}>{item.full_name} ({item.case_number})</option>)}</select></label>
      <label>Destination hospital<select required value={form.receiving_organisation_id} onChange={(event) => setForm({ ...form, receiving_organisation_id: event.target.value })}><option value="">Select hospital</option>{lookups.hospitals.map((hospital) => <option key={hospital.id} value={hospital.id}>{hospital.name}</option>)}</select></label>
      <label>Service required<input required value={form.service_required} onChange={(event) => setForm({ ...form, service_required: event.target.value })} /></label>
      <label>Urgency<select value={form.urgency} onChange={(event) => setForm({ ...form, urgency: event.target.value })}>{lookups.urgencyLevels.map((level) => <option key={level}>{level}</option>)}</select></label>
      <label className="wide">Reason<textarea required rows="5" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>
      <button className="primary wide" type="submit"><Send size={18} aria-hidden="true" />Submit referral</button>
    </form></section>
  );
}

function HospitalInbox({ referrals, refresh, setNotice }) {
  const active = referrals.filter((referral) => !['Completed', 'Cancelled', 'Rejected'].includes(referral.status));
  async function updateStatus(id, status) {
    await api(`/referrals/${id}/status`, { method: 'PATCH', body: { status } });
    setNotice(`Referral marked as ${status}.`);
    refresh();
  }
  return <section className="page"><h1>Hospital Inbox</h1><div className="inbox-list">{active.map((referral) => <article className="panel inbox-item" key={referral.id}><div><span className={statusClass[referral.status] || 'status'}>{referral.status}</span><h3>{referral.beneficiary_name}</h3><p>{referral.service_required} from {referral.ngo_name}</p></div><div className="button-row"><button onClick={() => updateStatus(referral.id, 'Accepted')}>Accept</button><button onClick={() => updateStatus(referral.id, 'Rejected')}>Reject</button><button onClick={() => updateStatus(referral.id, 'In Progress')}>In progress</button><button onClick={() => updateStatus(referral.id, 'Completed')}>Complete</button></div></article>)}</div></section>;
}

function Beneficiaries({ beneficiaries, refresh, setNotice }) {
  const { expandedPanel, togglePanel } = useExclusiveExpansion('profiles');
  const [expandedCaseProfileId, setExpandedCaseProfileId] = useState(null);
  const [form, setForm] = useState({ full_name: '', gender: 'Female', phone: '', county: '', location: '', vulnerability_notes: '', consent_recorded: true });
  async function submit(event) {
    event.preventDefault();
    await api('/beneficiaries', { method: 'POST', body: form });
    setNotice('Beneficiary case profile created.');
    setForm({ full_name: '', gender: 'Female', phone: '', county: '', location: '', vulnerability_notes: '', consent_recorded: true });
    refresh();
  }
  function toggleProfile(profileId) {
    setExpandedCaseProfileId((current) => (current === profileId ? null : profileId));
  }

  return (
    <section className="page">
      <h1>Client Case Profiles</h1>
      <div className="accordion-stack">
        <CollapsiblePanel id="create-profile" title="Create profile" summary="Add a new client case profile" expandedPanel={expandedPanel} onToggle={togglePanel}>
          <form className="stack" onSubmit={submit}>
            <label>Full name<input required value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></label>
            <label>Gender<select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}><option>Female</option><option>Male</option><option>Other</option></select></label>
            <label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
            <label>County<input required value={form.county} onChange={(event) => setForm({ ...form, county: event.target.value })} /></label>
            <label>Location<input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
            <label>Case notes<textarea rows="4" value={form.vulnerability_notes} onChange={(event) => setForm({ ...form, vulnerability_notes: event.target.value })} /></label>
            <label className="checkline"><input type="checkbox" checked={form.consent_recorded} onChange={(event) => setForm({ ...form, consent_recorded: event.target.checked })} /> Consent recorded</label>
            <button className="primary" type="submit"><Plus size={18} aria-hidden="true" />Save profile</button>
          </form>
        </CollapsiblePanel>
        <CollapsiblePanel id="profiles" title="Profiles" summary={`${beneficiaries.length} profile${beneficiaries.length === 1 ? '' : 's'}`} expandedPanel={expandedPanel} onToggle={togglePanel}>
          <div className="profile-list">
            {beneficiaries.map((person) => <CaseProfileCard key={person.id} person={person} isExpanded={expandedCaseProfileId === person.id} onToggle={() => toggleProfile(person.id)} />)}
            {!beneficiaries.length && <div className="empty">No case profiles have been created yet.</div>}
          </div>
        </CollapsiblePanel>
      </div>
    </section>
  );
}

function CaseProfileCard({ person, isExpanded, onToggle }) {
  return (
    <article className="profile-item">
      <button className="profile-toggle" type="button" onClick={onToggle} aria-expanded={isExpanded}>
        <span>
          <strong>{person.full_name}</strong>
          <span>{person.case_number}</span>
          <p>{person.county} · {person.location || 'Location not set'}</p>
        </span>
        <small>{person.referral_count} referrals</small>
      </button>
      {isExpanded && (
        <div className="profile-details">
          <div><span>Gender</span><strong>{person.gender}</strong></div>
          <div><span>Phone</span><strong>{person.phone || 'Not set'}</strong></div>
          <div><span>Consent</span><strong>{person.consent_recorded ? 'Recorded' : 'Not recorded'}</strong></div>
          <div><span>Last referral</span><strong>{formatDate(person.last_referral_at)}</strong></div>
          <div className="wide"><span>Case notes</span><strong>{person.vulnerability_notes || 'No notes added.'}</strong></div>
        </div>
      )}
    </article>
  );
}

function Feedback({ referrals, refresh, setNotice, user }) {
  if (user.role === ROLES.NGO_SOCIAL_WORKER) {
    return <NgoFeedback referrals={referrals} />;
  }

  const { expandedPanel, togglePanel } = useExclusiveExpansion('submit-feedback');
  const candidates = referrals.filter((referral) => !referral.feedback_id);
  const [form, setForm] = useState({ referral_id: '', outcome: 'Treated', treatment_given: '', discharge_status: '', recommendations: '' });
  async function submit(event) {
    event.preventDefault();
    await api(`/referrals/${form.referral_id}/feedback`, { method: 'POST', body: form });
    setNotice('Feedback submitted.');
    setForm({ referral_id: '', outcome: 'Treated', treatment_given: '', discharge_status: '', recommendations: '' });
    refresh();
  }
  return (
    <section className="page">
      <h1>Feedback Management</h1>
      <div className="accordion-stack">
        <CollapsiblePanel id="submit-feedback" title="Submit feedback" summary={`${candidates.length} referral${candidates.length === 1 ? '' : 's'} awaiting feedback`} expandedPanel={expandedPanel} onToggle={togglePanel}>
          <form className="form-grid" onSubmit={submit}>
            <label className="wide">Referral<select required value={form.referral_id} onChange={(event) => setForm({ ...form, referral_id: event.target.value })}><option value="">Select referral</option>{candidates.map((referral) => <option key={referral.id} value={referral.id}>{referral.referral_number} - {referral.beneficiary_name}</option>)}</select></label>
            <label>Outcome<select value={form.outcome} onChange={(event) => setForm({ ...form, outcome: event.target.value })}><option>Treated</option><option>Referred onward</option><option>Admitted</option><option>Discharged</option><option>No show</option><option>Other</option></select></label>
            <label>Discharge status<input value={form.discharge_status} onChange={(event) => setForm({ ...form, discharge_status: event.target.value })} /></label>
            <label className="wide">Treatment or service provided<textarea required rows="4" value={form.treatment_given} onChange={(event) => setForm({ ...form, treatment_given: event.target.value })} /></label>
            <label className="wide">Recommendations<textarea rows="4" value={form.recommendations} onChange={(event) => setForm({ ...form, recommendations: event.target.value })} /></label>
            <button className="primary wide" type="submit"><Send size={18} aria-hidden="true" />Submit feedback</button>
          </form>
        </CollapsiblePanel>
        <CollapsiblePanel id="feedback-status" title="Feedback status" summary={`${referrals.filter((referral) => referral.feedback_id).length} submitted`} expandedPanel={expandedPanel} onToggle={togglePanel}>
          <ReferralTable referrals={referrals.filter((referral) => referral.feedback_id)} compact />
        </CollapsiblePanel>
      </div>
    </section>
  );
}

function NgoFeedback({ referrals }) {
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const completed = referrals.filter((referral) => referral.feedback_id);

  async function viewFeedback(referral) {
    setLoading(true);
    try {
      const details = await api(`/referrals/${referral.id}`);
      setSelected(details);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page">
      <h1>Hospital Feedback</h1>
      <div className="content-grid">
        <section className="panel">
          <h3>Feedback received</h3>
          <div className="inbox-list">
            {completed.map((referral) => (
              <article className="inbox-item" key={referral.id}>
                <div>
                  <span className={statusClass[referral.status] || 'status'}>{referral.status}</span>
                  <h3>{referral.referral_number}</h3>
                  <p>{referral.beneficiary_name} · {referral.hospital_name}</p>
                </div>
                <button onClick={() => viewFeedback(referral)}>{loading ? 'Loading...' : 'View full feedback'}</button>
              </article>
            ))}
            {!completed.length && <p>No hospital feedback has been submitted yet.</p>}
          </div>
        </section>
        <section className="panel">
          <h3>Full feedback</h3>
          {selected?.feedback?.length ? selected.feedback.map((item) => (
            <article className="feedback-card" key={item.id}>
              <strong>{item.outcome}</strong>
              <p><b>Treatment or service:</b> {item.treatment_given}</p>
              <p><b>Discharge status:</b> {item.discharge_status || 'Not provided'}</p>
              <p><b>Recommendations:</b> {item.recommendations || 'None provided'}</p>
              <small>Submitted by {item.submitted_by_name} on {new Date(item.submitted_at).toLocaleString()}</small>
            </article>
          )) : <p>Select a referral to read the full feedback provided by the hospital.</p>}
        </section>
      </div>
    </section>
  );
}

function Reports({ reportOptions, lookups, user }) {
  const [form, setForm] = useState({ report_type: '', output_format: 'screen' });
  const [filters, setFilters] = useState({ date_preset: 'all' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const reports = reportOptions?.reports || [];
  const currentReportKey = form.report_type || reports[0]?.report_key || '';
  const selectedReport = reports.find((report) => report.report_key === currentReportKey);
  const availableFilters = selectedReport?.available_filters || [];
  const showReportType = reports.length > 1;

  useEffect(() => {
    if (!form.report_type && reports.length === 1) {
      setForm((current) => ({ ...current, report_type: reports[0].report_key }));
    }
  }, [reports.length, form.report_type]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function presetRange(preset) {
    const now = new Date();
    const yyyyMmDd = (date) => date.toISOString().slice(0, 10);
    if (preset === 'today') return { start_date: yyyyMmDd(now), end_date: yyyyMmDd(now) };
    if (preset === 'week') {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      return { start_date: yyyyMmDd(start), end_date: yyyyMmDd(now) };
    }
    if (preset === 'month') return { start_date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, end_date: yyyyMmDd(now) };
    if (preset === 'year') return { start_date: `${now.getFullYear()}-01-01`, end_date: yyyyMmDd(now) };
    if (preset === 'all') return { start_date: '', end_date: '' };
    return {};
  }

  function updateDatePreset(value) {
    setFilters((current) => ({ ...current, date_preset: value, ...presetRange(value) }));
  }

  async function generate(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const payload = await api('/reports/generate', {
        method: 'POST',
        body: {
          report_type: currentReportKey,
          filters,
          output_format: form.output_format
        }
      });
      setResult(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <h1>Reports</h1>
      <form className="panel report-builder" onSubmit={generate}>
        {showReportType ? (
          <label>
            Select Report Type
            <select required value={currentReportKey} onChange={(event) => setForm({ ...form, report_type: event.target.value })}>
              <option value="">Choose a report</option>
              {reports.map((report) => <option key={report.report_key} value={report.report_key}>{report.report_name}</option>)}
            </select>
          </label>
        ) : <div><h3>{selectedReport?.report_name || 'Activity Report'}</h3></div>}
        <div className="filters-panel">
          {availableFilters.includes('date_preset') && <label>Date range<select value={filters.date_preset || 'all'} onChange={(event) => updateDatePreset(event.target.value)}><option value="all">All time</option><option value="today">Today</option><option value="week">This week</option><option value="month">This month</option><option value="year">This year</option><option value="custom">Custom range</option></select></label>}
          {filters.date_preset === 'custom' && availableFilters.includes('start_date') && <label>Start date<input type="date" value={filters.start_date || ''} onChange={(event) => updateFilter('start_date', event.target.value)} /></label>}
          {filters.date_preset === 'custom' && availableFilters.includes('end_date') && <label>End date<input type="date" value={filters.end_date || ''} onChange={(event) => updateFilter('end_date', event.target.value)} /></label>}
          {availableFilters.includes('organisation_id') && user.role === ROLES.PLATFORM_ADMIN && <label>Organisation<select value={filters.organisation_id || ''} onChange={(event) => updateFilter('organisation_id', event.target.value)}><option value="">All organisations</option>{lookups.organisations.map((org) => <option key={org.id} value={org.id}>{org.name} ({org.type})</option>)}</select></label>}
        </div>
        <label>
          Output format
          <select value={form.output_format} onChange={(event) => setForm({ ...form, output_format: event.target.value })}>
            {(reportOptions?.output_formats || []).map((format) => <option key={format.value} value={format.value}>{format.label}</option>)}
          </select>
        </label>
        {error && <div className="alert error">{error}</div>}
        <button className="primary" type="submit" disabled={!currentReportKey || busy}><FileText size={18} aria-hidden="true" />{busy ? 'Generating...' : 'Generate Report'}</button>
      </form>
      <ReportResult result={result} />
    </section>
  );
}

function ReportResult({ result }) {
  if (!result) return null;
  const sections = result.sections || [{ title: result.report_name, rows: result.rows || [], summary: result.summary || {} }];
  return (
    <section className="report-preview">
      <div className="title-row">
        <div>
          <h2>{result.report_name}</h2>
          <p>Generated {new Date(result.generated_at).toLocaleString()} by {result.generated_by?.name || 'Current user'}</p>
        </div>
        <div className="button-row">
          <button type="button" onClick={() => window.print()}>Print Report</button>
          {result.file_url && <a className="download-link" href={result.file_url} download={result.file_name}>Download {String(result.output_format || '').toUpperCase()}</a>}
        </div>
      </div>
      <section className="panel">
        <h3>Selected filters</h3>
        <div className="detail-grid">
          {Object.entries(result.filters_applied || {}).map(([key, value]) => <div key={key}><span>{key.replaceAll('_', ' ')}</span><strong>{String(value)}</strong></div>)}
        </div>
      </section>
      <div className="metrics-grid">
        {(result.summary_cards || []).map((card) => <Metric key={card.label} label={card.label} value={card.value} icon={FileText} />)}
      </div>
      {!!result.charts?.length && <section className="panel"><h3>Charts</h3><div className="chart-grid">{result.charts.map((chart) => <ReportChart key={chart.title} chart={chart} />)}</div></section>}
      {sections.map((section) => <ReportSection key={section.title || section.report_key || section.report_name} section={section} />)}
      {!!result.observations?.length && <section className="panel"><h3>Observations</h3><div className="notice-list">{result.observations.map((item, index) => <div className="notice-item" key={index}><FileText size={16} aria-hidden="true" /><span>{item}</span></div>)}</div></section>}
    </section>
  );
}

function ReportChart({ chart }) {
  return <SimpleBarChart data={chart.rows || []} title={chart.title} />;
}

function ReportSection({ section }) {
  const rows = section.rows || [];
  const columns = rows.length ? Object.keys(rows[0]) : [];
  return (
    <section className="panel">
      <h3>{section.title || section.report_name}</h3>
      <p>{section.summary?.total_records ?? rows.length} records</p>
      {!rows.length ? <div className="empty">No records found</div> : (
        <div className="table-wrap">
          <table>
            <thead><tr>{columns.map((column) => <th key={column}>{column.replaceAll('_', ' ')}</th>)}</tr></thead>
            <tbody>{rows.map((row, index) => <tr key={index}>{columns.map((column) => <td key={column}>{String(row[column] ?? '')}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SimpleRows({ title, rows, columns }) {
  return <section className="page"><h1>{title}</h1><section className="panel"><div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id || index}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>)}</tr>)}</tbody></table></div></section></section>;
}

function UserProfile({ user }) {
  return (
    <section className="page">
      <h1>Profile</h1>
      <section className="panel">
        <div className="detail-grid">
          <div><span>Name</span><strong>{user.full_name}</strong></div>
          <div><span>Email</span><strong>{user.email}</strong></div>
          <div><span>Role</span><strong>{roleLabels[user.role]}</strong></div>
          <div><span>Organisation</span><strong>{user.organisation_name || 'Platform governance'}</strong></div>
          {user.organisation_type && <div><span>Organisation type</span><strong>{user.organisation_type}</strong></div>}
        </div>
      </section>
    </section>
  );
}

function StatusPage({ title, message, actionLabel, actionPath }) {
  const navigate = useNavigate();
  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand-mark"><HeartPulse size={30} aria-hidden="true" /></div>
        <h1>{title}</h1>
        <p>{message}</p>
        {actionPath && <button className="primary" type="button" onClick={() => navigate(actionPath)}>{actionLabel}</button>}
      </section>
    </main>
  );
}

function RequireRole({ user, roles, children }) {
  if (!roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}

function AuthenticatedApp({ user, onLogout }) {
  const navigate = useNavigate();
  const { data, loading, notice, setNotice, refresh, removeNotification } = useAppData(user);

  async function attendNotification(notificationId) {
    try {
      await api(`/dashboard/notifications/${notificationId}/attend`, { method: 'PATCH' });
      removeNotification(notificationId);
      return true;
    } catch (error) {
      setNotice(error.message);
      return false;
    }
  }

  function navigateToView(viewId) {
    navigate(routeForView(viewId, user));
  }

  function renderView(viewId) {
    const props = { refresh, setNotice };
    switch (viewId) {
      case 'organisations':
        return <Organisations organisations={data.admin.organisations} admins={data.admin.organisationAdmins} {...props} />;
      case 'organisation-admins':
        return <OrganisationAdmins admins={data.admin.organisationAdmins} loading={loading} user={user} />;
      case 'service-categories':
        return <ServiceCategories categories={data.admin.serviceCategories} {...props} />;
      case 'audit-logs':
        return <SimpleRows title="Audit Logs" rows={data.admin.auditLogs} columns={[{ key: 'created_at', label: 'Time' }, { key: 'actor_name', label: 'Actor' }, { key: 'action', label: 'Action' }, { key: 'entity_type', label: 'Entity' }]} />;
      case 'active-users':
        return <SimpleRows title="Active Users by Organisation" rows={data.admin.activeUsers} columns={[{ key: 'name', label: 'Organisation' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Status' }, { key: 'active_users', label: 'Active users' }]} />;
      case 'staff-users':
        return <StaffUsers staff={data.admin.staff} user={user} loading={loading} {...props} />;
      case 'profile':
        return user.role === ROLES.ORG_ADMIN ? <OrganisationProfile organisation={data.admin.organisationProfile} loading={loading} {...props} /> : <UserProfile user={user} />;
      case 'referrals':
        return user.role === ROLES.ORG_ADMIN
          ? <Referrals referrals={[]} statuses={data.lookups.statuses} user={user} {...props} />
          : <Referrals referrals={data.referrals} statuses={data.lookups.statuses} user={user} {...props} />;
      case 'new-referral':
        return <NewReferral lookups={data.lookups} beneficiaries={data.beneficiaries} {...props} />;
      case 'hospital-inbox':
        return <HospitalInbox referrals={data.referrals} {...props} />;
      case 'beneficiaries':
        return <Beneficiaries beneficiaries={data.beneficiaries} {...props} />;
      case 'feedback':
        return <Feedback referrals={data.referrals} user={user} {...props} />;
      case 'reports':
        return <Reports reportOptions={data.reportOptions} lookups={data.lookups} user={user} />;
      default:
        return <Dashboard dashboard={data.dashboard} onNavigate={navigateToView} onAttendNotification={attendNotification} user={user} loading={loading} />;
    }
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={dashboardPathForUser(user)} replace />} />
      <Route path="/login" element={<Navigate to={dashboardPathForUser(user)} replace />} />
      <Route path="/unauthorized" element={<StatusPage title="Unauthorized" message="You do not have access to that area." actionLabel="Go to my dashboard" actionPath={dashboardPathForUser(user)} />} />
      <Route path="/not-found" element={<StatusPage title="Page not found" message="That ReferralLink page does not exist." actionLabel="Go to my dashboard" actionPath={dashboardPathForUser(user)} />} />

      <Route path="/platform" element={<RequireRole user={user} roles={[ROLES.PLATFORM_ADMIN]}><Shell user={user} onLogout={onLogout} notice={notice} setNotice={setNotice} loading={loading} /></RequireRole>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={renderView('dashboard')} />
        <Route path="organisations" element={renderView('organisations')} />
        <Route path="organisation-admins" element={renderView('organisation-admins')} />
        <Route path="service-categories" element={renderView('service-categories')} />
        <Route path="audit-logs" element={renderView('audit-logs')} />
        <Route path="active-users" element={renderView('active-users')} />
        <Route path="reports" element={renderView('reports')} />
      </Route>

      <Route path="/org-admin" element={<RequireRole user={user} roles={[ROLES.ORG_ADMIN]}><Shell user={user} onLogout={onLogout} notice={notice} setNotice={setNotice} loading={loading} /></RequireRole>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={renderView('dashboard')} />
        <Route path="staff-users" element={renderView('staff-users')} />
        <Route path="referrals" element={renderView('referrals')} />
        <Route path="reports" element={renderView('reports')} />
        <Route path="profile" element={renderView('profile')} />
      </Route>

      <Route path="/ngo" element={<RequireRole user={user} roles={[ROLES.NGO_SOCIAL_WORKER]}><Shell user={user} onLogout={onLogout} notice={notice} setNotice={setNotice} loading={loading} /></RequireRole>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={renderView('dashboard')} />
        <Route path="referrals" element={renderView('referrals')} />
        <Route path="new-referral" element={renderView('new-referral')} />
        <Route path="case-profiles" element={renderView('beneficiaries')} />
        <Route path="feedback" element={renderView('feedback')} />
        <Route path="reports" element={renderView('reports')} />
        <Route path="profile" element={renderView('profile')} />
      </Route>

      <Route path="/hospital" element={<RequireRole user={user} roles={[ROLES.HOSPITAL_RECORDS_KEEPER]}><Shell user={user} onLogout={onLogout} notice={notice} setNotice={setNotice} loading={loading} /></RequireRole>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={renderView('dashboard')} />
        <Route path="inbox" element={renderView('hospital-inbox')} />
        <Route path="referrals" element={renderView('referrals')} />
        <Route path="feedback" element={renderView('feedback')} />
        <Route path="reports" element={renderView('reports')} />
        <Route path="profile" element={renderView('profile')} />
      </Route>

      <Route path="*" element={<Navigate to="/not-found" replace />} />
    </Routes>
  );
}

function App() {
  const [user, setUser] = useState(getStoredUser());
  const navigate = useNavigate();

  function handleLogin(nextUser) {
    setUser(nextUser);
    navigate(dashboardPathForUser(nextUser), { replace: true });
  }

  function logout() {
    clearSession();
    setUser(null);
    navigate('/login', { replace: true });
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/unauthorized" element={<StatusPage title="Unauthorized" message="Please sign in with an account that can access this area." actionLabel="Sign in" actionPath="/login" />} />
        <Route path="/not-found" element={<StatusPage title="Page not found" message="That ReferralLink page does not exist." actionLabel="Sign in" actionPath="/login" />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return <AuthenticatedApp user={user} onLogout={logout} />;
}

createRoot(document.getElementById('root')).render(<BrowserRouter><App /></BrowserRouter>);
