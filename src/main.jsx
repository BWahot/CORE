import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
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
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  UserRound,
  UsersRound
} from 'lucide-react';
import { api, clearSession, getStoredUser, setSession } from './api/client.js';
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
  INACTIVE: 'status pending',
  ARCHIVED: 'status rejected'
};

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'organisations', label: 'Organisations', icon: Building2, roles: [ROLES.PLATFORM_ADMIN] },
  { id: 'organisation-admins', label: 'Organisation Admins', icon: UserCog, roles: [ROLES.PLATFORM_ADMIN] },
  { id: 'service-categories', label: 'Service Categories', icon: SlidersHorizontal, roles: [ROLES.PLATFORM_ADMIN] },
  { id: 'audit-logs', label: 'Audit Logs', icon: FileText, roles: [ROLES.PLATFORM_ADMIN] },
  { id: 'active-users', label: 'Active Users', icon: UsersRound, roles: [ROLES.PLATFORM_ADMIN] },
  { id: 'system-statistics', label: 'System Statistics', icon: Activity, roles: [ROLES.PLATFORM_ADMIN] },
  { id: 'settings', label: 'Settings', icon: Settings, roles: [ROLES.PLATFORM_ADMIN] },
  { id: 'staff-users', label: 'Staff Users', icon: UsersRound, roles: [ROLES.ORG_ADMIN] },
  { id: 'org-roles', label: 'Roles', icon: ShieldCheck, roles: [ROLES.ORG_ADMIN] },
  { id: 'org-profile', label: 'Organisation Profile', icon: Building2, roles: [ROLES.ORG_ADMIN] },
  { id: 'org-reports', label: 'Organisation Reports', icon: FileText, roles: [ROLES.ORG_ADMIN] },
  { id: 'referrals', label: 'Referrals', icon: ClipboardList, roles: [ROLES.NGO_SOCIAL_WORKER, ROLES.HOSPITAL_RECORDS_KEEPER] },
  { id: 'new-referral', label: 'New Referral', icon: Plus, roles: [ROLES.NGO_SOCIAL_WORKER] },
  { id: 'hospital-inbox', label: 'Hospital Inbox', icon: Hospital, roles: [ROLES.HOSPITAL_RECORDS_KEEPER] },
  { id: 'beneficiaries', label: 'Case Profiles', icon: UsersRound, roles: [ROLES.NGO_SOCIAL_WORKER] },
  { id: 'feedback', label: 'Feedback', icon: Send, roles: [ROLES.NGO_SOCIAL_WORKER, ROLES.HOSPITAL_RECORDS_KEEPER] },
  { id: 'reports', label: 'Reports', icon: FileText, roles: [ROLES.PLATFORM_ADMIN, ROLES.ORG_ADMIN, ROLES.NGO_SOCIAL_WORKER, ROLES.HOSPITAL_RECORDS_KEEPER] }
];

function isAllowedView(viewId, user) {
  if (!user) return false;
  const item = navItems.find((navItem) => navItem.id === viewId);
  return Boolean(item && (!item.roles || item.roles.includes(user.role)));
}

function defaultViewForUser(user) {
  return isAllowedView('dashboard', user) ? 'dashboard' : navItems.find((item) => isAllowedView(item.id, user))?.id || 'dashboard';
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
      organisationProfile: null,
      organisationReports: null
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
        const [staff, profile, orgReports] = await Promise.all([
          api('/admin/staff'),
          api('/admin/organisation-profile'),
          api('/admin/organisation-reports')
        ]);
        next.admin.staff = staff.staff;
        next.admin.organisationProfile = profile.organisation;
        next.admin.organisationReports = orgReports;
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

  return { data, loading, notice, setNotice, refresh };
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

function Shell({ user, onLogout, children, active, setActive }) {
  const allowedNav = navItems.filter((item) => !item.roles || item.roles.includes(user.role));
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="app-logo"><HeartPulse size={24} aria-hidden="true" /><span>ReferralLink</span></div>
        <nav>
          {allowedNav.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} className={active === item.id ? 'nav active' : 'nav'} onClick={() => setActive(item.id)}><Icon size={18} aria-hidden="true" /><span>{item.label}</span></button>;
          })}
        </nav>
        <button className="nav logout" onClick={onLogout}><LogOut size={18} aria-hidden="true" /><span>Logout</span></button>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div><p>{roleLabels[user.role]}</p><h2>{user.full_name}</h2></div>
          <div className="org-pill"><UserRound size={18} aria-hidden="true" /><span>{user.organisation_name || 'Platform governance'}</span></div>
        </header>
        {children}
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon, tone }) {
  return <article className={`metric ${tone || ''}`}><Icon size={22} aria-hidden="true" /><div><strong>{value}</strong><span>{label}</span></div></article>;
}

function Dashboard({ dashboard }) {
  const statusRows = dashboard?.metrics?.byStatus || [];
  const mode = dashboard?.mode || 'operational';
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
            <ManagementCard icon={Building2} title="Organisations" text="Add, edit, deactivate, and archive NGOs and hospitals." />
            <ManagementCard icon={UserCog} title="Organisation admins" text="Create the first administrator account for each organisation." />
            <ManagementCard icon={UsersRound} title="Active users" text="View active user counts grouped by organisation." />
            <ManagementCard icon={SlidersHorizontal} title="Service categories" text="Manage referral service types used across the platform." />
            <ManagementCard icon={FileText} title="Audit logs" text="Review system access and administrative actions." />
            <ManagementCard icon={Activity} title="System statistics" text="Track organisation count, active users, and total referral count only." />
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
            <Metric label="Total referrals" value={dashboard?.metrics?.totalReferrals || 0} icon={ClipboardList} />
            <Metric label="Urgent open cases" value={dashboard?.metrics?.urgentOpen || 0} icon={Activity} tone="warm" />
            <Metric label="Pending feedback" value={dashboard?.metrics?.pendingFeedback || 0} icon={Bell} tone="cool" />
            <Metric label="Completed" value={statusRows.find((row) => row.status === 'Completed')?.total || 0} icon={CheckCircle2} tone="good" />
          </div>
          <div className="content-grid">
            <section className="panel"><h3>Recent referrals</h3><ReferralTable referrals={dashboard?.recent || []} compact /></section>
            <NotificationPanel notifications={dashboard?.notifications || []} />
          </div>
        </>
      )}
    </section>
  );
}

function ManagementCard({ icon: Icon, title, text }) {
  return <article className="management-card"><Icon size={22} aria-hidden="true" /><div><strong>{title}</strong><p>{text}</p></div></article>;
}

function NotificationPanel({ notifications }) {
  return (
    <section className="panel">
      <h3>Notifications</h3>
      <div className="notice-list">
        {notifications.map((notification) => <div key={notification.id} className="notice-item"><Bell size={16} aria-hidden="true" /><div><strong>{notification.title}</strong><p>{notification.message}</p></div></div>)}
      </div>
    </section>
  );
}

function ReferralTable({ referrals, compact }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Reference</th><th>Beneficiary</th>{!compact && <th>Organisation</th>}<th>Hospital</th><th>Urgency</th><th>Status</th>{!compact && <th>Service</th>}</tr></thead>
        <tbody>
          {referrals.map((referral) => (
            <tr key={referral.id}>
              <td>{referral.referral_number}</td><td>{referral.beneficiary_name}</td>{!compact && <td>{referral.ngo_name}</td>}<td>{referral.hospital_name}</td><td>{referral.urgency}</td><td><span className={statusClass[referral.status] || 'status'}>{referral.status}</span></td>{!compact && <td>{referral.service_required}</td>}
            </tr>
          ))}
          {!referrals.length && <tr><td colSpan={compact ? 5 : 7} className="empty">No referrals found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Organisations({ organisations, refresh, setNotice }) {
  const { expandedPanel, togglePanel } = useExclusiveExpansion('directory');
  const [form, setForm] = useState({ name: '', type: 'NGO', email: '', phone: '', location: '', status: 'ACTIVE' });
  async function submit(event) {
    event.preventDefault();
    await api('/admin/organisations', { method: 'POST', body: form });
    setForm({ name: '', type: 'NGO', email: '', phone: '', location: '', status: 'ACTIVE' });
    setNotice('Organisation created.');
    refresh();
  }
  async function saveOrganisation(organisation) {
    await api(`/admin/organisations/${organisation.id}`, { method: 'PATCH', body: organisation });
    setNotice('Organisation updated.');
    refresh();
  }
  return (
    <section className="page">
      <h1>Organisations</h1>
      <div className="accordion-stack">
        <CollapsiblePanel id="add" title="Add organisation" summary="Create an NGO or hospital record" expandedPanel={expandedPanel} onToggle={togglePanel} fallbackPanel="directory">
          <form className="stack" onSubmit={submit}>
            <label>Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label>Type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>NGO</option><option>HOSPITAL</option></select></label>
            <label>Email<input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
            <label>Location<input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
            <button className="primary" type="submit"><Plus size={18} aria-hidden="true" />Add organisation</button>
          </form>
        </CollapsiblePanel>
        <CollapsiblePanel id="directory" title="Directory" summary={`${organisations.length} organisation${organisations.length === 1 ? '' : 's'}`} expandedPanel={expandedPanel} onToggle={togglePanel} fallbackPanel="add">
          <OrganisationTable organisations={organisations} onSave={saveOrganisation} />
        </CollapsiblePanel>
      </div>
    </section>
  );
}

function OrganisationTable({ organisations, onSave }) {
  return (
    <div className="table-wrap"><table><thead><tr><th>Name</th><th>Type</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      {organisations.map((organisation) => <OrganisationRow key={organisation.id} organisation={organisation} onSave={onSave} />)}
      {!organisations.length && <tr><td colSpan="5" className="empty">No organisations have been added yet.</td></tr>}
    </tbody></table></div>
  );
}

function OrganisationRow({ organisation, onSave }) {
  const [draft, setDraft] = useState({ ...organisation });
  return (
    <tr>
      <td><input value={draft.name || ''} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></td>
      <td>{draft.type}</td>
      <td><input value={draft.location || ''} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></td>
      <td><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}><option>ACTIVE</option><option>INACTIVE</option><option>ARCHIVED</option></select></td>
      <td><button onClick={() => onSave(draft)}>Save</button></td>
    </tr>
  );
}

function OrganisationAdmins({ organisations, admins, loading, refresh, setNotice }) {
  const { expandedPanel, togglePanel } = useExclusiveExpansion('directory');
  const [form, setForm] = useState({ organisation_id: '', full_name: '', email: '', password: 'password123' });
  async function submit(event) {
    event.preventDefault();
    await api(`/admin/organisations/${form.organisation_id}/admins`, { method: 'POST', body: form });
    setForm({ organisation_id: '', full_name: '', email: '', password: 'password123' });
    setNotice('Organisation administrator created.');
    refresh();
  }
  async function saveAdmin(admin) {
    await api(`/admin/organisation-admins/${admin.id}`, {
      method: 'PATCH',
      body: {
        organisation_id: admin.organisation_id,
        full_name: admin.full_name,
        email: admin.email,
        status: admin.status
      }
    });
    setNotice('Organisation administrator updated.');
    refresh();
  }
  return (
    <section className="page">
      <h1>Organisation Admins</h1>
      <div className="accordion-stack">
        <CollapsiblePanel id="create" title="Create administrator" summary="Assign an administrator to an organisation" expandedPanel={expandedPanel} onToggle={togglePanel} fallbackPanel="directory">
          <form className="form-grid" onSubmit={submit}>
            <label className="wide">Organisation<select required value={form.organisation_id} onChange={(event) => setForm({ ...form, organisation_id: event.target.value })}><option value="">Select organisation</option>{organisations.map((org) => <option key={org.id} value={org.id}>{org.name} ({org.type})</option>)}</select></label>
            <label>Full name<input required value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></label>
            <label>Email<input required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label>Password<input required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
            <button className="primary wide" type="submit"><UserCog size={18} aria-hidden="true" />Create admin</button>
          </form>
        </CollapsiblePanel>
        <CollapsiblePanel id="directory" title="Administrator directory" summary={`${admins.length} administrator${admins.length === 1 ? '' : 's'}`} expandedPanel={expandedPanel} onToggle={togglePanel} fallbackPanel="create">
          {loading ? <div className="empty">Loading organisation administrators...</div> : <OrganisationAdminTable admins={admins} organisations={organisations} onSave={saveAdmin} />}
        </CollapsiblePanel>
      </div>
    </section>
  );
}

function OrganisationAdminTable({ admins, organisations, onSave }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Organisation</th><th>Type</th><th>Status</th><th>Date added</th><th>Actions</th></tr></thead>
        <tbody>
          {admins.map((admin) => <OrganisationAdminRow key={admin.id} admin={admin} organisations={organisations} onSave={onSave} />)}
          {!admins.length && <tr><td colSpan="7" className="empty">No organisation administrators have been added yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function OrganisationAdminRow({ admin, organisations, onSave }) {
  const [draft, setDraft] = useState({ ...admin });
  const selectedOrganisation = organisations.find((organisation) => Number(organisation.id) === Number(draft.organisation_id));

  return (
    <tr>
      <td><input value={draft.full_name || ''} onChange={(event) => setDraft({ ...draft, full_name: event.target.value })} /></td>
      <td><input value={draft.email || ''} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></td>
      <td><select value={draft.organisation_id || ''} onChange={(event) => setDraft({ ...draft, organisation_id: event.target.value })}>{organisations.map((organisation) => <option key={organisation.id} value={organisation.id}>{organisation.name}</option>)}</select></td>
      <td>{selectedOrganisation?.type || admin.organisation_type || 'Not available'}</td>
      <td><select value={draft.status || 'ACTIVE'} onChange={(event) => setDraft({ ...draft, status: event.target.value })}><option>ACTIVE</option><option>INACTIVE</option></select></td>
      <td>{formatDate(admin.created_at)}</td>
      <td><button onClick={() => onSave(draft)}>Save</button></td>
    </tr>
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

function ServiceCategories({ categories, refresh, setNotice }) {
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
      <div className="content-grid">
        <form className="panel stack" onSubmit={submit}>
          <h3>Add referral service type</h3>
          <label>Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>Description<textarea rows="4" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <button className="primary" type="submit"><Plus size={18} aria-hidden="true" />Add service type</button>
        </form>
        <section className="panel">
          <h3>Service types</h3>
          <div className="table-wrap"><table><thead><tr><th>Name</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead><tbody>{categories.map((category) => <tr key={category.id}><td>{category.name}</td><td>{category.description}</td><td>{category.is_active ? <span className="status completed">Active</span> : <span className="status pending">Inactive</span>}</td><td><button onClick={() => toggle(category)}>{category.is_active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div>
        </section>
      </div>
    </section>
  );
}

function Referrals({ referrals }) {
  const [search, setSearch] = useState('');
  const filtered = referrals.filter((referral) => `${referral.referral_number} ${referral.beneficiary_name} ${referral.status} ${referral.hospital_name}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="page"><div className="title-row"><h1>Referral Tracking</h1><div className="search-box"><Search size={17} aria-hidden="true" /><input placeholder="Search referrals" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div><section className="panel"><ReferralTable referrals={filtered} /></section></section>;
}

function NewReferral({ lookups, beneficiaries, refresh, setNotice }) {
  const [form, setForm] = useState({ beneficiary_id: '', receiving_organisation_id: '', service_required: '', urgency: 'Medium', reason: '', due_date: '' });
  async function submit(event) {
    event.preventDefault();
    await api('/referrals', { method: 'POST', body: form });
    setForm({ beneficiary_id: '', receiving_organisation_id: '', service_required: '', urgency: 'Medium', reason: '', due_date: '' });
    setNotice('Referral submitted.');
    refresh();
  }
  return (
    <section className="page"><h1>New Referral</h1><form className="panel form-grid" onSubmit={submit}>
      <label>Beneficiary<select required value={form.beneficiary_id} onChange={(event) => setForm({ ...form, beneficiary_id: event.target.value })}><option value="">Select beneficiary</option>{beneficiaries.map((item) => <option key={item.id} value={item.id}>{item.full_name} ({item.case_number})</option>)}</select></label>
      <label>Destination hospital<select required value={form.receiving_organisation_id} onChange={(event) => setForm({ ...form, receiving_organisation_id: event.target.value })}><option value="">Select hospital</option>{lookups.hospitals.map((hospital) => <option key={hospital.id} value={hospital.id}>{hospital.name}</option>)}</select></label>
      <label>Service required<input required value={form.service_required} onChange={(event) => setForm({ ...form, service_required: event.target.value })} /></label>
      <label>Urgency<select value={form.urgency} onChange={(event) => setForm({ ...form, urgency: event.target.value })}>{lookups.urgencyLevels.map((level) => <option key={level}>{level}</option>)}</select></label>
      <label>Due date<input type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} /></label>
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
  const [form, setForm] = useState({ full_name: '', gender: 'Female', phone: '', county: '', location: '', vulnerability_notes: '', consent_recorded: true });
  async function submit(event) {
    event.preventDefault();
    await api('/beneficiaries', { method: 'POST', body: form });
    setNotice('Beneficiary case profile created.');
    setForm({ full_name: '', gender: 'Female', phone: '', county: '', location: '', vulnerability_notes: '', consent_recorded: true });
    refresh();
  }
  return <section className="page"><h1>Client Case Profiles</h1><div className="content-grid"><form className="panel stack" onSubmit={submit}><h3>Create profile</h3><label>Full name<input required value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></label><label>Gender<select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}><option>Female</option><option>Male</option><option>Other</option></select></label><label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label>County<input required value={form.county} onChange={(event) => setForm({ ...form, county: event.target.value })} /></label><label>Location<input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label><label>Case notes<textarea rows="4" value={form.vulnerability_notes} onChange={(event) => setForm({ ...form, vulnerability_notes: event.target.value })} /></label><label className="checkline"><input type="checkbox" checked={form.consent_recorded} onChange={(event) => setForm({ ...form, consent_recorded: event.target.checked })} /> Consent recorded</label><button className="primary" type="submit"><Plus size={18} aria-hidden="true" />Save profile</button></form><section className="panel"><h3>Profiles</h3><div className="profile-list">{beneficiaries.map((person) => <article key={person.id} className="profile-item"><strong>{person.full_name}</strong><span>{person.case_number}</span><p>{person.county} · {person.location || 'Location not set'}</p><small>{person.referral_count} referrals</small></article>)}</div></section></div></section>;
}

function Feedback({ referrals, refresh, setNotice, user }) {
  if (user.role === ROLES.NGO_SOCIAL_WORKER) {
    return <NgoFeedback referrals={referrals} />;
  }

  const candidates = referrals.filter((referral) => !referral.feedback_id);
  const [form, setForm] = useState({ referral_id: '', outcome: 'Treated', treatment_given: '', discharge_status: '', recommendations: '' });
  async function submit(event) {
    event.preventDefault();
    await api(`/referrals/${form.referral_id}/feedback`, { method: 'POST', body: form });
    setNotice('Feedback submitted.');
    setForm({ referral_id: '', outcome: 'Treated', treatment_given: '', discharge_status: '', recommendations: '' });
    refresh();
  }
  return <section className="page"><h1>Feedback Management</h1><div className="content-grid"><form className="panel form-grid" onSubmit={submit}><label className="wide">Referral<select required value={form.referral_id} onChange={(event) => setForm({ ...form, referral_id: event.target.value })}><option value="">Select referral</option>{candidates.map((referral) => <option key={referral.id} value={referral.id}>{referral.referral_number} - {referral.beneficiary_name}</option>)}</select></label><label>Outcome<select value={form.outcome} onChange={(event) => setForm({ ...form, outcome: event.target.value })}><option>Treated</option><option>Referred onward</option><option>Admitted</option><option>Discharged</option><option>No show</option><option>Other</option></select></label><label>Discharge status<input value={form.discharge_status} onChange={(event) => setForm({ ...form, discharge_status: event.target.value })} /></label><label className="wide">Treatment or service provided<textarea required rows="4" value={form.treatment_given} onChange={(event) => setForm({ ...form, treatment_given: event.target.value })} /></label><label className="wide">Recommendations<textarea rows="4" value={form.recommendations} onChange={(event) => setForm({ ...form, recommendations: event.target.value })} /></label><button className="primary wide" type="submit"><Send size={18} aria-hidden="true" />Submit feedback</button></form><section className="panel"><h3>Feedback status</h3><ReferralTable referrals={referrals.filter((referral) => referral.feedback_id)} compact /></section></div></section>;
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
  const [filters, setFilters] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const reports = reportOptions?.reports || [];
  const selectedReport = reports.find((report) => report.report_key === form.report_type);
  const availableFilters = selectedReport?.available_filters || [];

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
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
          report_type: form.report_type,
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
        <label>
          Select Report Type
          <select required value={form.report_type} onChange={(event) => setForm({ ...form, report_type: event.target.value })}>
            <option value="">Choose a report</option>
            {reports.map((report) => <option key={report.report_key} value={report.report_key}>{report.report_name}</option>)}
          </select>
        </label>
        <div className="filters-panel">
          {availableFilters.includes('start_date') && <label>Start date<input type="date" value={filters.start_date || ''} onChange={(event) => updateFilter('start_date', event.target.value)} /></label>}
          {availableFilters.includes('end_date') && <label>End date<input type="date" value={filters.end_date || ''} onChange={(event) => updateFilter('end_date', event.target.value)} /></label>}
          {availableFilters.includes('status') && <label>Referral status<select value={filters.status || ''} onChange={(event) => updateFilter('status', event.target.value)}><option value="">Any status</option>{lookups.statuses.map((status) => <option key={status}>{status}</option>)}</select></label>}
          {availableFilters.includes('feedback_status') && <label>Feedback status<select value={filters.feedback_status || ''} onChange={(event) => updateFilter('feedback_status', event.target.value)}><option value="">Any feedback</option><option value="PENDING">Pending</option><option value="SUBMITTED">Submitted</option></select></label>}
          {availableFilters.includes('service_type') && <label>Service type<input value={filters.service_type || ''} onChange={(event) => updateFilter('service_type', event.target.value)} placeholder="e.g. Maternal health assessment" /></label>}
          {availableFilters.includes('urgency') && <label>Urgency level<select value={filters.urgency || ''} onChange={(event) => updateFilter('urgency', event.target.value)}><option value="">Any urgency</option>{lookups.urgencyLevels.map((level) => <option key={level}>{level}</option>)}</select></label>}
          {availableFilters.includes('organisation_id') && user.role === ROLES.NGO_SOCIAL_WORKER && <label>Destination hospital<select value={filters.organisation_id || ''} onChange={(event) => updateFilter('organisation_id', event.target.value)}><option value="">All hospitals</option>{lookups.hospitals.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>}
          {availableFilters.includes('organisation_id') && user.role === ROLES.HOSPITAL_RECORDS_KEEPER && <label>Referring NGO<select value={filters.organisation_id || ''} onChange={(event) => updateFilter('organisation_id', event.target.value)}><option value="">All NGOs</option>{lookups.ngos.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>}
          {availableFilters.includes('staff_id') && <label>Staff member<select value={filters.staff_id || ''} onChange={(event) => updateFilter('staff_id', event.target.value)}><option value="">All staff</option>{lookups.users.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>}
          {availableFilters.includes('organisation_type') && <label>Organisation type<select value={filters.organisation_type || ''} onChange={(event) => updateFilter('organisation_type', event.target.value)}><option value="">All types</option><option>NGO</option><option>HOSPITAL</option></select></label>}
          {availableFilters.includes('organisation_status') && <label>Organisation status<select value={filters.organisation_status || ''} onChange={(event) => updateFilter('organisation_status', event.target.value)}><option value="">All statuses</option><option>ACTIVE</option><option>INACTIVE</option><option>ARCHIVED</option></select></label>}
        </div>
        <label>
          Output format
          <select value={form.output_format} onChange={(event) => setForm({ ...form, output_format: event.target.value })}>
            {(reportOptions?.output_formats || []).map((format) => <option key={format.value} value={format.value}>{format.label}</option>)}
          </select>
        </label>
        {error && <div className="alert error">{error}</div>}
        <button className="primary" type="submit" disabled={!form.report_type || busy}><FileText size={18} aria-hidden="true" />{busy ? 'Generating...' : 'Generate Report'}</button>
      </form>
      <ReportResult result={result} />
    </section>
  );
}

function ReportResult({ result }) {
  if (!result) return null;
  const sections = result.sections || [{ report_name: result.report_name, rows: result.rows || [], summary: result.summary || {} }];
  return (
    <section className="report-preview">
      <div className="title-row">
        <div>
          <h2>{result.report_name}</h2>
          <p>Generated {new Date(result.generated_at).toLocaleString()}</p>
        </div>
        {result.file_url && <a className="download-link" href={result.file_url} download={result.file_name}>Download {result.output_format}</a>}
      </div>
      {sections.map((section) => <ReportSection key={section.report_key || section.report_name} section={section} />)}
    </section>
  );
}

function ReportSection({ section }) {
  const rows = section.rows || [];
  const columns = rows.length ? Object.keys(rows[0]) : [];
  return (
    <section className="panel">
      <h3>{section.report_name}</h3>
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

function App() {
  const [user, setUser] = useState(getStoredUser());
  const [active, setActive] = useState('dashboard');
  const { data, loading, notice, setNotice, refresh } = useAppData(user);

  useEffect(() => {
    if (!user) return;
    if (!isAllowedView(active, user)) setActive(defaultViewForUser(user));
  }, [user?.role, active]);

  function handleLogin(nextUser) {
    setUser(nextUser);
    setActive(defaultViewForUser(nextUser));
  }

  const view = useMemo(() => {
    const props = { refresh, setNotice };
    const safeActive = isAllowedView(active, user) ? active : defaultViewForUser(user);
    switch (safeActive) {
      case 'organisations':
        return <Organisations organisations={data.admin.organisations} {...props} />;
      case 'organisation-admins':
        return <OrganisationAdmins organisations={data.admin.organisations} admins={data.admin.organisationAdmins} loading={loading} {...props} />;
      case 'service-categories':
        return <ServiceCategories categories={data.admin.serviceCategories} {...props} />;
      case 'audit-logs':
        return <SimpleRows title="Audit Logs" rows={data.admin.auditLogs} columns={[{ key: 'created_at', label: 'Time' }, { key: 'actor_name', label: 'Actor' }, { key: 'action', label: 'Action' }, { key: 'entity_type', label: 'Entity' }]} />;
      case 'active-users':
        return <SimpleRows title="Active Users by Organisation" rows={data.admin.activeUsers} columns={[{ key: 'name', label: 'Organisation' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Status' }, { key: 'active_users', label: 'Active users' }]} />;
      case 'system-statistics':
        return <SimpleRows title="System Statistics" rows={[data.admin.systemStatistics || {}]} columns={[{ key: 'totalOrganisations', label: 'Organisations' }, { key: 'activeUsers', label: 'Active users' }, { key: 'totalReferrals', label: 'Total referrals' }]} />;
      case 'settings':
        return <Reports reportOptions={data.reportOptions} lookups={data.lookups} user={user} />;
      case 'staff-users':
        return <StaffUsers staff={data.admin.staff} user={user} loading={loading} {...props} />;
      case 'org-roles':
        return <SimpleRows title="Roles within Organisation" rows={(user.organisation_type === 'NGO' ? [ROLES.ORG_ADMIN, ROLES.NGO_SOCIAL_WORKER] : [ROLES.ORG_ADMIN, ROLES.HOSPITAL_RECORDS_KEEPER]).map((role) => ({ role }))} columns={[{ key: 'role', label: 'Role' }]} />;
      case 'org-profile':
        return <SimpleRows title="Organisation Profile" rows={data.admin.organisationProfile ? [data.admin.organisationProfile] : []} columns={[{ key: 'name', label: 'Name' }, { key: 'type', label: 'Type' }, { key: 'location', label: 'Location' }, { key: 'status', label: 'Status' }]} />;
      case 'org-reports':
        return <Reports reportOptions={data.reportOptions} lookups={data.lookups} user={user} />;
      case 'referrals':
        return <Referrals referrals={data.referrals} {...props} />;
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
        return <Dashboard dashboard={data.dashboard} />;
    }
  }, [active, data, user]);

  if (!user) return <Login onLogin={handleLogin} />;

  function logout() {
    clearSession();
    setUser(null);
  }

  return <Shell user={user} onLogout={logout} active={active} setActive={setActive}>{notice && <button className="toast" onClick={() => setNotice('')}>{notice}</button>}{loading && <div className="loading">Loading latest records...</div>}{view}</Shell>;
}

createRoot(document.getElementById('root')).render(<App />);
