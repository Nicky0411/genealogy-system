import {
  ArrowLeft,
  Check,
  Edit3,
  Inbox,
  LogIn,
  LogOut,
  Plus,
  Save,
  Search,
  Trash2,
  UserRound,
  UserPlus,
  X
} from "lucide-react";
import { FormEvent, MouseEvent, useEffect, useMemo, useState } from "react";
import { apiRequest } from "./lib/api";

type Gender = "M" | "F";

interface AuthUser {
  userId: number;
  username: string;
  email: string;
}

interface Family {
  familyId: number;
  familyName: string;
  surname: string;
  description: string | null;
  revisionTime: string;
  createdByUsername: string;
  role: string;
  memberCount: number;
}

interface Member {
  memberId: number;
  familyId: number;
  name: string;
  gender: Gender;
  birthYear: number | null;
  deathYear: number | null;
  generation: number;
  fatherId: number | null;
  motherId: number | null;
  spouseId: number | null;
  birthplace?: string | null;
  biography?: string | null;
}

interface Invitation {
  invitationId: number;
  familyId: number;
  familyName: string;
  surname: string;
  inviterUsername: string;
  status: string;
  createdAt: string;
}

interface FamilyForm {
  familyName: string;
  surname: string;
  description: string;
}

interface MemberForm {
  name: string;
  gender: Gender;
  birthYear: string;
  deathYear: string;
  generation: string;
  fatherId: string;
  motherId: string;
  spouseId: string;
  birthplace: string;
  biography: string;
}

const emptyFamilyForm: FamilyForm = {
  familyName: "",
  surname: "",
  description: ""
};

const emptyMemberForm: MemberForm = {
  name: "",
  gender: "M",
  birthYear: "",
  deathYear: "",
  generation: "1",
  fatherId: "",
  motherId: "",
  spouseId: "",
  birthplace: "",
  biography: ""
};

function toOptionalNumber(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number(trimmed);
}

function familyToForm(family: Family): FamilyForm {
  return {
    familyName: family.familyName,
    surname: family.surname,
    description: family.description ?? ""
  };
}

function memberToForm(member: Member): MemberForm {
  return {
    name: member.name,
    gender: member.gender,
    birthYear: member.birthYear?.toString() ?? "",
    deathYear: member.deathYear?.toString() ?? "",
    generation: member.generation.toString(),
    fatherId: member.fatherId?.toString() ?? "",
    motherId: member.motherId?.toString() ?? "",
    spouseId: member.spouseId?.toString() ?? "",
    birthplace: member.birthplace ?? "",
    biography: member.biography ?? ""
  };
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function Pagination({
  page,
  totalPages,
  onPageChange
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  const [jumpValue, setJumpValue] = useState("");

  const pages = useMemo(() => {
    const result: (number | "ellipsis")[] = [];
    const range = 2;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - range && i <= page + range)) {
        result.push(i);
      } else if (result[result.length - 1] !== "ellipsis") {
        result.push("ellipsis");
      }
    }
    return result;
  }, [page, totalPages]);

  function handleJump() {
    const target = parseInt(jumpValue, 10);
    if (target >= 1 && target <= totalPages) {
      onPageChange(target);
      setJumpValue("");
    }
  }

  return (
    <div className="pagination">
      <button className="ghost-button page-btn" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        上一页
      </button>
      {pages.map((item, i) =>
        item === "ellipsis" ? (
          <span className="page-ellipsis" key={`e${i}`}>…</span>
        ) : (
          <button
            className={`page-num ${item === page ? "active" : ""}`}
            key={item}
            onClick={() => onPageChange(item)}
          >
            {item}
          </button>
        )
      )}
      <button className="ghost-button page-btn" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        下一页
      </button>
      <span className="page-jump">
        跳至
        <input
          type="number"
          min={1}
          max={totalPages}
          value={jumpValue}
          onChange={(e) => setJumpValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleJump(); }}
          placeholder={`${totalPages}`}
        />
        页
      </span>
    </div>
  );
}

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem("genealogy-token") ?? "");
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem("genealogy-user");
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  });
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null);
  const [familyRefreshKey, setFamilyRefreshKey] = useState(0);

  function handleLogin(nextToken: string, nextUser: AuthUser) {
    localStorage.setItem("genealogy-token", nextToken);
    localStorage.setItem("genealogy-user", JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  }

  function handleLogout() {
    localStorage.removeItem("genealogy-token");
    localStorage.removeItem("genealogy-user");
    setToken("");
    setUser(null);
    setSelectedFamily(null);
  }

  if (!token || !user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <AppFrame
      user={user}
      token={token}
      onLogout={handleLogout}
      onInvitationsChanged={() => setFamilyRefreshKey((value) => value + 1)}
    >
      {selectedFamily ? (
        <MembersPage
          family={selectedFamily}
          token={token}
          refreshKey={familyRefreshKey}
          onBack={() => setSelectedFamily(null)}
          onSelectFamily={setSelectedFamily}
        />
      ) : (
        <FamiliesPage token={token} refreshKey={familyRefreshKey} onOpenFamily={setSelectedFamily} />
      )}
    </AppFrame>
  );
}

function LoginPage({ onLogin }: { onLogin: (token: string, user: AuthUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [usernameOrEmail, setUsernameOrEmail] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register" && password !== confirmPassword) {
        setError("两次输入的密码不一致");
        return;
      }

      const result = await apiRequest<{ token: string; user: AuthUser }>(mode === "login" ? "/auth/login" : "/auth/register", {
        method: "POST",
        body: JSON.stringify(
          mode === "login"
            ? { usernameOrEmail, password }
            : { username: usernameOrEmail, password, confirmPassword }
        )
      });
      onLogin(result.token, result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-panel" onSubmit={submit}>
        <div className="brand login-brand">
          <div className="brand-mark">谱</div>
          <div>
            <strong>族谱管理系统</strong>
            <span>PostgreSQL</span>
          </div>
        </div>

        <div className="auth-tabs" role="tablist" aria-label="账号入口">
          <button
            className={mode === "login" ? "active" : ""}
            type="button"
            onClick={() => {
              setMode("login");
              setUsernameOrEmail("admin");
              setPassword("admin123");
              setConfirmPassword("");
              setError("");
            }}
          >
            登录
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            type="button"
            onClick={() => {
              setMode("register");
              setUsernameOrEmail("");
              setPassword("");
              setConfirmPassword("");
              setError("");
            }}
          >
            注册
          </button>
        </div>

        <div className="form-stack">
          <label>
            <span>账号</span>
            <input value={usernameOrEmail} onChange={(event) => setUsernameOrEmail(event.target.value)} />
          </label>
          <label>
            <span>密码</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {mode === "register" && (
            <label>
              <span>确认密码</span>
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </label>
          )}
        </div>

        {mode === "login" && (
          <div className="test-account">
            <span>测试账号</span>
            <strong>admin / admin123</strong>
          </div>
        )}

        {error && <p className="error-text">{error}</p>}

        <button className="primary-button wide-button" type="submit" disabled={loading}>
          <LogIn size={18} />
          <span>{loading ? (mode === "login" ? "登录中" : "注册中") : mode === "login" ? "登录" : "注册并进入"}</span>
        </button>
      </form>
    </main>
  );
}

function AppFrame({
  user,
  token,
  onLogout,
  onInvitationsChanged,
  children
}: {
  user: AuthUser;
  token: string;
  onLogout: () => void;
  onInvitationsChanged: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadInvitations() {
    setLoading(true);
    setMessage("");
    try {
      const result = await apiRequest<{ data: Invitation[] }>("/invitations", { token });
      setInvitations(result.data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "加载邀请失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInvitations();
  }, [token]);

  async function handleInvitation(invitation: Invitation, action: "accept" | "reject") {
    setMessage("");
    try {
      await apiRequest(`/invitations/${invitation.invitationId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ action })
      });
      await loadInvitations();
      onInvitationsChanged();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "处理邀请失败");
    }
  }

  return (
    <div className="app-frame">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">谱</div>
          <div>
            <strong>族谱管理系统</strong>
            <span>{user.username}</span>
          </div>
        </div>

        <div className="header-actions">
          <div className="mailbox">
            <button className="icon-button" type="button" title="邀请信箱" onClick={() => setOpen((value) => !value)}>
              <Inbox size={18} />
              {invitations.length > 0 && <span className="badge">{invitations.length}</span>}
            </button>

            {open && (
              <div className="mailbox-popover">
                <div className="mailbox-heading">
                  <strong>邀请申请</strong>
                  <button className="icon-button small-icon-button" type="button" title="关闭" onClick={() => setOpen(false)}>
                    <X size={15} />
                  </button>
                </div>

                {message && <p className="error-text">{message}</p>}

                <div className="invitation-list">
                  {loading ? (
                    <div className="empty-state compact-empty">加载中</div>
                  ) : invitations.length === 0 ? (
                    <div className="empty-state compact-empty">暂无邀请</div>
                  ) : (
                    invitations.map((invitation) => (
                      <article className="invitation-item" key={invitation.invitationId}>
                        <div>
                          <strong>{invitation.familyName}</strong>
                          <span>
                            {invitation.inviterUsername} 邀请你加入 {invitation.surname}氏族谱
                          </span>
                        </div>
                        <div className="invitation-actions">
                          <button
                            className="primary-button small-action-button"
                            type="button"
                            onClick={() => void handleInvitation(invitation, "accept")}
                          >
                            <Check size={15} />
                            <span>确认</span>
                          </button>
                          <button
                            className="ghost-button small-action-button"
                            type="button"
                            onClick={() => void handleInvitation(invitation, "reject")}
                          >
                            <X size={15} />
                            <span>取消</span>
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button className="ghost-button" type="button" onClick={onLogout}>
            <LogOut size={18} />
            <span>退出登录</span>
          </button>
        </div>
      </header>

      <main className="app-content">{children}</main>
    </div>
  );
}

interface TreeNodeData {
  member: Member | null;
  father: TreeNodeData | null;
  mother: TreeNodeData | null;
}

function PedigreeChart({
  data,
  rootId
}: {
  data: (Member & { depth?: number })[];
  rootId: number;
}) {
  const memberMap = useMemo(() => {
    const map = new Map<number, Member>();
    for (const m of data) map.set(m.memberId, m);
    return map;
  }, [data]);

  const { levels } = useMemo(() => {
    function build(memberId: number | null, remainDepth: number): TreeNodeData {
      const m = memberId ? memberMap.get(memberId) ?? null : null;
      if (!m || remainDepth <= 0) {
        return { member: m, father: null, mother: null };
      }
      return {
        member: m,
        father: build(m.fatherId ?? null, remainDepth - 1),
        mother: build(m.motherId ?? null, remainDepth - 1)
      };
    }

    const root = build(rootId, 3);

    const result: (TreeNodeData | null)[][] = [];
    function collect(node: TreeNodeData | null, depth: number) {
      if (depth >= result.length) result.push([]);
      result[depth].push(node);
      if (depth < 3) {
        collect(node?.father ?? null, depth + 1);
        collect(node?.mother ?? null, depth + 1);
      }
    }
    collect(root, 0);

    return { levels: result.reverse() };
  }, [memberMap, rootId]);

  if (levels.length === 0) return null;

  const labelFor = (depth: number, m: Member | null) => {
    if (!m) return null;
    if (depth === 0) return "本人";
    if (depth === 1) return m.gender === "M" ? "父" : "母";
    if (depth === 2) return m.gender === "M" ? "祖父" : "祖母";
    return m.gender === "M" ? "曾祖" : "曾祖母";
  };

  return (
    <div className="pedigree-tree">
      {levels.map((nodes, levelIndex) => { const actualDepth = levels.length - 1 - levelIndex; return (
        <div key={levelIndex}>
          {levelIndex > 0 && (
            <div
              className="tree-connectors"
              style={{ gridTemplateColumns: `repeat(${levels[levelIndex - 1].length}, minmax(0, 1fr))` }}
            >
              {levels[levelIndex - 1].map((_, ni) => (
                <div className="tree-connector-cell" key={ni} />
              ))}
            </div>
          )}
          <div
            className="tree-level"
            style={{ gridTemplateColumns: `repeat(${nodes.length}, minmax(0, 1fr))` }}
          >
            {nodes.map((node, ni) => (
              <div className="tree-cell" key={ni}>
                {node?.member ? (
                  <div className={`tree-card ${actualDepth === 0 ? "tree-card-self" : ""}`}>
                    <span className="tree-card-label">{labelFor(actualDepth, node.member)}</span>
                    <span className="tree-card-name">{node.member.name}</span>
                    <span className="tree-card-meta">
                      {node.member.gender === "M" ? "男" : "女"}
                      {node.member.birthYear != null || node.member.deathYear != null
                        ? ` · ${node.member.birthYear ?? "?"} — ${node.member.deathYear ?? "?"}`
                        : ""}
                    </span>
                  </div>
                ) : (
                  <div className="tree-card tree-card-empty">—</div>
                )}
              </div>
            ))}
          </div>
        </div>
        ); })}
    </div>
  );
}

function FamiliesPage({
  token,
  refreshKey,
  onOpenFamily
}: {
  token: string;
  refreshKey: number;
  onOpenFamily: (family: Family) => void;
}) {
  const [families, setFamilies] = useState<Family[]>([]);
  const [form, setForm] = useState(emptyFamilyForm);
  const [editing, setEditing] = useState<Family | null>(null);
  const [familyModalOpen, setFamilyModalOpen] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<Family | null>(null);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ancestor query
  const [ancestorModalOpen, setAncestorModalOpen] = useState(false);
  const [ancestorMemberId, setAncestorMemberId] = useState("");
  const [ancestorResults, setAncestorResults] = useState<(Member & { depth?: number })[]>([]);
  const [ancestorLoading, setAncestorLoading] = useState(false);
  const [ancestorError, setAncestorError] = useState("");

  // path query
  const [pathModalOpen, setPathModalOpen] = useState(false);
  const [pathStartId, setPathStartId] = useState("");
  const [pathTargetId, setPathTargetId] = useState("");
  const [pathResult, setPathResult] = useState<{ depth: number; path: Member[] } | null>(null);
  const [pathLoading, setPathLoading] = useState(false);
  const [pathError, setPathError] = useState("");

  async function loadFamilies() {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest<{ data: Family[] }>("/families", { token });
      setFamilies(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFamilies();
  }, [token, refreshKey]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const payload = {
      familyName: form.familyName.trim(),
      surname: form.surname.trim(),
      description: form.description.trim()
    };

    try {
      if (editing) {
        await apiRequest(`/families/${editing.familyId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload)
        });
      } else {
        await apiRequest("/families", {
          method: "POST",
          token,
          body: JSON.stringify(payload)
        });
      }
      setForm(emptyFamilyForm);
      setEditing(null);
      setFamilyModalOpen(false);
      await loadFamilies();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function removeFamily(event: MouseEvent, family: Family) {
    event.stopPropagation();
    if (!window.confirm(`删除 ${family.familyName}？`)) return;
    await apiRequest(`/families/${family.familyId}`, { method: "DELETE", token });
    await loadFamilies();
  }

  function startEdit(event: MouseEvent, family: Family) {
    event.stopPropagation();
    setEditing(family);
    setForm(familyToForm(family));
    setFamilyModalOpen(true);
  }

  function startCreate() {
    setEditing(null);
    setForm({ ...emptyFamilyForm });
    setError("");
    setFamilyModalOpen(true);
  }

  function startInvite(event: MouseEvent, family: Family) {
    event.stopPropagation();
    setInviteTarget(family);
    setInviteUsername("");
    setInviteMessage("");
  }

  async function submitInvite(event: FormEvent) {
    event.preventDefault();
    if (!inviteTarget) return;
    setInviteMessage("");

    try {
      await apiRequest("/invitations", {
        method: "POST",
        token,
        body: JSON.stringify({
          familyId: inviteTarget.familyId,
          username: inviteUsername.trim()
        })
      });
      setInviteMessage(`已向 ${inviteUsername.trim()} 发出邀请`);
      setInviteUsername("");
    } catch (err) {
      setInviteMessage(err instanceof Error ? err.message : "邀请失败");
    }
  }

  function cancelEdit() {
    setEditing(null);
    setForm({ ...emptyFamilyForm });
    setError("");
    setFamilyModalOpen(false);
  }

  async function queryAncestors(event: FormEvent) {
    event.preventDefault();
    setAncestorError("");
    setAncestorResults([]);
    setAncestorLoading(true);
    try {
      const mid = Number(ancestorMemberId);
      const [memberRes, ancestorRes] = await Promise.all([
        apiRequest<{ data: Member }>(`/members/${mid}`, { token }),
        apiRequest<{ data: (Member & { depth?: number })[] }>(
          `/genealogy/members/${mid}/ancestors?maxDepth=3`,
          { token }
        )
      ]);
      setAncestorResults([memberRes.data, ...ancestorRes.data]);
      if (ancestorRes.data.length === 0) setAncestorError("未查询到祖先数据（可能此人没有录入父辈信息）");
    } catch (err) {
      setAncestorError(err instanceof Error ? err.message : "查询失败");
    } finally {
      setAncestorLoading(false);
    }
  }

  function getKinship(a: Member, b: Member): string {
    if (b.memberId === a.fatherId) return "父";
    if (b.memberId === a.motherId) return "母";
    if (a.memberId === b.fatherId) return b.gender === "M" ? "子" : "女";
    if (a.memberId === b.motherId) return b.gender === "M" ? "子" : "女";
    return "亲属";
  }

  async function queryPath(event: FormEvent) {
    event.preventDefault();
    setPathError("");
    setPathResult(null);
    setPathLoading(true);
    try {
      const start = Number(pathStartId);
      const target = Number(pathTargetId);
      const result = await apiRequest<{ data: { depth: number; path: Member[] } | null }>(
        `/genealogy/members/${start}/path?targetId=${target}`,
        { token }
      );
      setPathResult(result.data);
      if (!result.data) setPathError("未找到两人之间的亲缘路径");
    } catch (err) {
      setPathError(err instanceof Error ? err.message : "查询失败");
    } finally {
      setPathLoading(false);
    }
  }

  const totalMembers = useMemo(() => families.reduce((sum, family) => sum + family.memberCount, 0), [families]);

  return (
    <div className="home-workspace">
      <header className="topbar">
        <div>
          <p className="eyebrow">首页</p>
          <h1>族谱管理</h1>
        </div>
      </header>

      <div className="query-tools">
        <button className="ghost-button" type="button" onClick={() => { setAncestorError(""); setAncestorResults([]); setAncestorMemberId(""); setAncestorModalOpen(true); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="21" x2="21" y2="3"/><path d="M9 3H21V15"/></svg>
          <span>祖先查询</span>
        </button>
        <button className="ghost-button" type="button" onClick={() => { setPathError(""); setPathResult(null); setPathStartId(""); setPathTargetId(""); setPathModalOpen(true); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="17" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="18" cy="10" r="2"/><circle cx="6" cy="10" r="2"/><line x1="6" y1="10" x2="12" y2="6"/><line x1="12" y1="6" x2="18" y2="10"/><line x1="18" y1="10" x2="12" y2="17"/><line x1="12" y1="17" x2="6" y2="10"/></svg>
          <span>亲缘关系查询</span>
        </button>
      </div>

      <div className="home-layout">
        <section className="home-family-section">
          <section className="panel list-panel">
            <div className="panel-heading">
              <h2>全部族谱</h2>
              <div className="panel-actions">
                <button className="primary-button" type="button" onClick={startCreate}>
                  <Plus size={16} />
                  <span>创建族谱</span>
                </button>
                <button className="ghost-button" type="button" onClick={() => void loadFamilies()}>
                  <Search size={16} />
                  <span>刷新</span>
                </button>
              </div>
            </div>

            <div className="family-list">
              {loading ? (
                <div className="empty-state">加载中</div>
              ) : (
                families.map((family) => (
                  <article
                    className="family-row"
                    role="button"
                    tabIndex={0}
                    key={family.familyId}
                    onClick={() => onOpenFamily(family)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") onOpenFamily(family);
                    }}
                  >
                    <span className="family-mark">{family.surname}</span>
                    <span className="family-main">
                      <strong>{family.familyName}</strong>
                      <span>{family.description}</span>
                      <span>
                        最新修改 {formatDate(family.revisionTime)} · 创建用户 {family.createdByUsername}
                      </span>
                    </span>
                    <span className="family-count">{family.memberCount.toLocaleString()} 人</span>
                    <span className="row-actions">
                      <button className="icon-button" type="button" title="编辑" onClick={(event) => startEdit(event, family)}>
                        <Edit3 size={16} />
                      </button>
                      <button className="icon-button" type="button" title="邀请用户" onClick={(event) => startInvite(event, family)}>
                        <UserPlus size={16} />
                      </button>
                      <button className="icon-button" type="button" title="删除" onClick={(event) => void removeFamily(event, family)}>
                        <Trash2 size={16} />
                      </button>
                    </span>
                  </article>
                ))
              )}
            </div>
          </section>
        </section>

        <aside className="stats-sidebar" aria-label="族谱概览">
          <article className="metric">
            <span>族谱数量</span>
            <strong>{families.length}</strong>
          </article>
          <article className="metric">
            <span>成员总数</span>
            <strong>{totalMembers.toLocaleString()}</strong>
          </article>
          <article className="metric">
            <span>最大族谱</span>
            <strong>{Math.max(0, ...families.map((family) => family.memberCount)).toLocaleString()}</strong>
          </article>
        </aside>
      </div>

      {familyModalOpen && (
        <div className="modal-backdrop" onMouseDown={cancelEdit}>
          <form className="modal-panel" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
            <div className="panel-heading modal-heading">
              <h2>{editing ? "编辑族谱" : "创建族谱"}</h2>
              <button className="icon-button" type="button" title="关闭" onClick={cancelEdit}>
                <X size={17} />
              </button>
            </div>
            <div className="form-body">
              <label>
                <span>族谱名称</span>
                <input
                  required
                  value={form.familyName}
                  onChange={(event) => setForm({ ...form, familyName: event.target.value })}
                />
              </label>
              <label>
                <span>姓氏</span>
                <input required value={form.surname} onChange={(event) => setForm({ ...form, surname: event.target.value })} />
              </label>
              <label>
                <span>描述</span>
                <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </label>
              {error && <p className="error-text">{error}</p>}
              <button className="primary-button wide-button" type="submit">
                <Save size={18} />
                <span>{editing ? "保存修改" : "创建族谱"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {inviteTarget && (
        <div className="modal-backdrop" onMouseDown={() => setInviteTarget(null)}>
          <form className="modal-panel" onSubmit={submitInvite} onMouseDown={(event) => event.stopPropagation()}>
            <div className="panel-heading modal-heading">
              <h2>邀请用户</h2>
              <button className="icon-button" type="button" title="关闭" onClick={() => setInviteTarget(null)}>
                <X size={17} />
              </button>
            </div>
            <div className="form-body">
              <p className="modal-note">邀请对方加入 {inviteTarget.familyName}</p>
              <label>
                <span>用户账号</span>
                <input
                  required
                  value={inviteUsername}
                  onChange={(event) => setInviteUsername(event.target.value)}
                  placeholder="例如 guest"
                />
              </label>
              {inviteMessage && <p className="error-text">{inviteMessage}</p>}
              <button className="primary-button wide-button" type="submit">
                <UserPlus size={18} />
                <span>发送邀请</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {ancestorModalOpen && (
        <div className="modal-backdrop" onMouseDown={() => setAncestorModalOpen(false)}>
          <div className="modal-panel modal-wide modal-pedigree" onMouseDown={(event) => event.stopPropagation()}>
            <div className="panel-heading modal-heading">
              <h2>祖先查询（向上3代）</h2>
              <button className="icon-button" type="button" title="关闭" onClick={() => setAncestorModalOpen(false)}>
                <X size={17} />
              </button>
            </div>
            <div className="form-body">
              <form onSubmit={queryAncestors}>
                <label>
                  <span>人物 ID</span>
                  <input
                    required
                    inputMode="numeric"
                    value={ancestorMemberId}
                    onChange={(e) => setAncestorMemberId(e.target.value)}
                    placeholder="输入成员 ID"
                  />
                </label>
                <button className="primary-button wide-button" type="submit" disabled={ancestorLoading}>
                  <Search size={18} />
                  <span>{ancestorLoading ? "查询中" : "查询祖先"}</span>
                </button>
              </form>
              {ancestorError && <p className="error-text">{ancestorError}</p>}
              {ancestorResults.length > 0 && (
                <div className="query-results">
                  <PedigreeChart data={ancestorResults} rootId={Number(ancestorMemberId)} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {pathModalOpen && (
        <div className="modal-backdrop" onMouseDown={() => setPathModalOpen(false)}>
          <div className="modal-panel modal-wide" onMouseDown={(event) => event.stopPropagation()}>
            <div className="panel-heading modal-heading">
              <h2>亲缘关系查询</h2>
              <button className="icon-button" type="button" title="关闭" onClick={() => setPathModalOpen(false)}>
                <X size={17} />
              </button>
            </div>
            <div className="form-body">
              <form onSubmit={queryPath}>
                <div className="form-pair">
                  <label>
                    <span>人物 ID (起点)</span>
                    <input
                      required
                      inputMode="numeric"
                      value={pathStartId}
                      onChange={(e) => setPathStartId(e.target.value)}
                      placeholder="输入成员 ID"
                    />
                  </label>
                  <label>
                    <span>人物 ID (终点)</span>
                    <input
                      required
                      inputMode="numeric"
                      value={pathTargetId}
                      onChange={(e) => setPathTargetId(e.target.value)}
                      placeholder="输入成员 ID"
                    />
                  </label>
                </div>
                <button className="primary-button wide-button" type="submit" disabled={pathLoading}>
                  <Search size={18} />
                  <span>{pathLoading ? "查询中" : "查询路径"}</span>
                </button>
              </form>
              {pathError && <p className="error-text">{pathError}</p>}
              {pathResult && (
                <div className="query-results">
                  <p className="path-summary">
                    亲缘距离 <strong>{pathResult.depth}</strong> 步
                  </p>
                  <div className="path-chain">
                    {pathResult.path.map((m, i) => (
                      <div key={m.memberId} className="path-node-wrapper">
                        <div className="path-node">
                          <span className="path-node-name">{m.name}</span>
                          <span className="path-node-meta">
                            ID {m.memberId} · {m.gender === "M" ? "男" : "女"} · 第{m.generation}代
                            {m.birthYear != null || m.deathYear != null
                              ? ` · ${m.birthYear ?? "?"} — ${m.deathYear ?? "?"}`
                              : ""}
                          </span>
                        </div>
                        {i < pathResult.path.length - 1 && (
                          <div className="path-arrow">
                            <span className="path-kinship">{getKinship(m, pathResult.path[i + 1])}</span>
                            <svg width="14" height="18" viewBox="0 0 14 18" fill="none" stroke="#999" strokeWidth="2">
                              <line x1="7" y1="0" x2="7" y2="14" />
                              <polyline points="2,10 7,16 12,10" />
                            </svg>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TreeView({
  root,
  token,
  onBack,
  onReroot,
  onSelectFamily
}: {
  root: Member;
  token: string;
  onBack: () => void;
  onReroot: (member: Member) => void;
  onSelectFamily: (family: Family) => void;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [childrenMap, setChildrenMap] = useState<Map<number, Member[]>>(new Map());
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());

  async function toggleExpand(member: Member) {
    if (expandedIds.has(member.memberId)) {
      const next = new Set(expandedIds);
      next.delete(member.memberId);
      setExpandedIds(next);
      return;
    }

    if (!childrenMap.has(member.memberId)) {
      setLoadingIds((prev) => new Set(prev).add(member.memberId));
      try {
        const result = await apiRequest<{ data: Member[] }>(
          `/members/${member.memberId}/children`,
          { token }
        );
        setChildrenMap((prev) => new Map(prev).set(member.memberId, result.data));
      } catch {
        // ignore
      } finally {
        setLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(member.memberId);
          return next;
        });
      }
    }

    setExpandedIds((prev) => new Set(prev).add(member.memberId));
  }

  useEffect(() => {
    void toggleExpand(root);
  }, [root.memberId]);

  function renderNode(member: Member, depth: number): React.ReactNode {
    const expanded = expandedIds.has(member.memberId);
    const children = childrenMap.get(member.memberId) ?? [];
    const isLoading = loadingIds.has(member.memberId);
    const hasChildren = children.length > 0 || !childrenMap.has(member.memberId);

    return (
      <div key={member.memberId}>
        <div className="tree-row" style={{ paddingLeft: depth * 28 }}>
          {hasChildren ? (
            <button
              className="tree-toggle"
              type="button"
              disabled={isLoading}
              onClick={() => void toggleExpand(member)}
            >
              {isLoading ? "…" : expanded ? "▾" : "▸"}
            </button>
          ) : (
            <span className="tree-toggle tree-toggle-spacer" />
          )}
          <button
            className="tree-name"
            type="button"
            onClick={() => onReroot(member)}
            title="以此人为中心重新查看"
          >
            {member.name}
          </button>
          <span className="tree-meta">
            {member.gender === "M" ? "男" : "女"}
            {member.birthYear != null || member.deathYear != null
              ? ` · ${member.birthYear ?? "?"} — ${member.deathYear ?? "?"}`
              : ""}
            · 第{member.generation}代
          </span>
        </div>
        {expanded &&
          children.map((child) => (
            <div key={child.memberId}>{renderNode(child, depth + 1)}</div>
          ))}
      </div>
    );
  }

  return (
    <div className="tree-view">
      <div className="tree-header">
        <button className="ghost-button" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>返回列表</span>
        </button>
        <span className="tree-root-label">
          当前中心：<strong>{root.name}</strong>
        </span>
      </div>
      <div className="tree-body">{renderNode(root, 0)}</div>
    </div>
  );
}

function MembersPage({
  family,
  token,
  refreshKey,
  onBack,
  onSelectFamily
}: {
  family: Family;
  token: string;
  refreshKey: number;
  onBack: () => void;
  onSelectFamily: (family: Family) => void;
}) {
  const [families, setFamilies] = useState<Family[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [keyword, setKeyword] = useState("");
  const [generation, setGeneration] = useState("");
  const [form, setForm] = useState<MemberForm>({ ...emptyMemberForm, generation: "1" });
  const [editing, setEditing] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [familyLoading, setFamilyLoading] = useState(true);
  const [error, setError] = useState("");
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [treeRoot, setTreeRoot] = useState<Member | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [genderStats, setGenderStats] = useState({ male: 0, female: 0, total: 0 });
  const pageSize = 20;

  const malePct = genderStats.total > 0 ? Math.round((genderStats.male / genderStats.total) * 100) : 0;
  const femalePct = genderStats.total > 0 ? Math.round((genderStats.female / genderStats.total) * 100) : 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  async function loadFamilySidebar() {
    setFamilyLoading(true);
    try {
      const result = await apiRequest<{ data: Family[] }>("/families", { token });
      setFamilies(result.data);
    } catch {
      setFamilies([]);
    } finally {
      setFamilyLoading(false);
    }
  }

  async function loadMembers() {
    setLoading(true);
    setError("");
    const offset = (page - 1) * pageSize;
    const params = new URLSearchParams({
      familyId: String(family.familyId),
      limit: String(pageSize),
      offset: String(offset)
    });
    if (keyword.trim()) params.set("q", keyword.trim());
    if (generation.trim()) params.set("generation", generation.trim());

    try {
      const result = await apiRequest<{ data: Member[]; total: number }>(`/members?${params.toString()}`, { token });
      setMembers(result.data);
      setTotalCount(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function loadGenderStats() {
    try {
      const result = await apiRequest<{ data: { male: number; female: number; total: number } }>(
        `/families/${family.familyId}/stats`,
        { token }
      );
      setGenderStats(result.data);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void loadFamilySidebar();
  }, [token, refreshKey]);

  useEffect(() => {
    setPage(1);
  }, [keyword, generation]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMembers();
    }, 220);
    return () => window.clearTimeout(timer);
  }, [family.familyId, keyword, generation, page]);

  useEffect(() => {
    void loadGenderStats();
  }, [family.familyId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    const payload = {
      familyId: family.familyId,
      name: form.name.trim(),
      gender: form.gender,
      birthYear: toOptionalNumber(form.birthYear),
      deathYear: toOptionalNumber(form.deathYear),
      generation: Number(form.generation),
      fatherId: toOptionalNumber(form.fatherId),
      motherId: toOptionalNumber(form.motherId),
      spouseId: toOptionalNumber(form.spouseId),
      birthplace: form.birthplace.trim() || null,
      biography: form.biography.trim() || null
    };

    try {
      if (editing) {
        await apiRequest(`/members/${editing.memberId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload)
        });
      } else {
        await apiRequest("/members", {
          method: "POST",
          token,
          body: JSON.stringify(payload)
        });
      }
      setEditing(null);
      setForm({ ...emptyMemberForm });
      setMemberModalOpen(false);
      await loadMembers();
      await loadGenderStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function removeMember(member: Member) {
    if (!window.confirm(`删除 ${member.name}？`)) return;
    await apiRequest(`/members/${member.memberId}`, { method: "DELETE", token });
    await loadMembers();
    await loadGenderStats();
  }

  function startCreate() {
    setEditing(null);
    setForm({ ...emptyMemberForm });
    setError("");
    setMemberModalOpen(true);
  }

  function startEdit(member: Member) {
    setEditing(member);
    setForm(memberToForm(member));
    setError("");
    setMemberModalOpen(true);
  }

  function cancelEdit() {
    setEditing(null);
    setForm({ ...emptyMemberForm });
    setError("");
    setMemberModalOpen(false);
  }

  function switchFamily(nextFamily: Family) {
    onSelectFamily(nextFamily);
    setKeyword("");
    setGeneration("");
    setEditing(null);
    setForm({ ...emptyMemberForm });
    setError("");
    setPage(1);
    setTreeRoot(null);
  }

  return (
    <div className="detail-shell">
      <aside className="family-sidebar">
        <div className="side-heading">
          <button className="icon-button" type="button" title="返回首页" onClick={onBack}>
            <ArrowLeft size={17} />
          </button>
          <div>
            <span>族谱条目</span>
            <strong>全部族谱</strong>
          </div>
        </div>

        <div className="side-family-list">
          {familyLoading ? (
            <div className="side-empty">加载中</div>
          ) : (
            families.map((item) => (
              <button
                className={`side-family-item ${item.familyId === family.familyId ? "active" : ""}`}
                type="button"
                key={item.familyId}
                onClick={() => switchFamily(item)}
              >
                <span className="side-family-mark">{item.surname}</span>
                <span className="side-family-main">
                  <strong>{item.familyName}</strong>
                  <span>{item.memberCount.toLocaleString()} 人</span>
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="detail-workspace">
        <header className="topbar">
          <div className="title-row">
            <div>
              <p className="eyebrow">{family.surname}氏</p>
              <h1>{family.familyName}</h1>
            </div>
          </div>
        </header>

        {treeRoot ? (
          <TreeView
            root={treeRoot}
            token={token}
            onBack={() => setTreeRoot(null)}
            onReroot={(member) => setTreeRoot(member)}
            onSelectFamily={onSelectFamily}
          />
        ) : (
          <>
            <section className="toolbar" aria-label="成员筛选">
          <label className="search-box">
            <Search size={18} />
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索姓名" />
          </label>
          <input
            className="generation-input"
            value={generation}
            onChange={(event) => setGeneration(event.target.value)}
            placeholder="代数"
            inputMode="numeric"
          />
          <button className="primary-button" type="button" onClick={startCreate}>
            <Plus size={16} />
            <span>新增成员</span>
          </button>
        </section>

        <div className="detail-content">
          <section className="panel list-panel member-list-panel">
            <div className="panel-heading">
              <h2>成员列表</h2>
              <span className="list-count">{members.length} 条</span>
            </div>

            <div className="member-list">
              {loading ? (
                <div className="empty-state">加载中</div>
              ) : (
                members.map((member) => (
                  <article className="member-row" key={member.memberId}>
                    <span className="avatar">
                      <UserRound size={18} />
                    </span>
                    <span className="member-main">
                      <button
                        className="member-name-link"
                        type="button"
                        onClick={() => setTreeRoot(member)}
                        title="查看树状图"
                      >
                        {member.name}
                      </button>
                      <span>
                        ID {member.memberId} · 第 {member.generation} 代 · {member.gender === "M" ? "男" : "女"}
                      </span>
                    </span>
                    <span className="member-years">
                      {member.birthYear ?? "-"} / {member.deathYear ?? "-"}
                    </span>
                    <span className="row-actions">
                      <button className="icon-button" type="button" title="查看树状图" onClick={() => setTreeRoot(member)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="17" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="18" cy="10" r="2"/><circle cx="6" cy="10" r="2"/><line x1="6" y1="10" x2="12" y2="6"/><line x1="12" y1="6" x2="18" y2="10"/><line x1="18" y1="10" x2="12" y2="17"/><line x1="12" y1="17" x2="6" y2="10"/></svg>
                      </button>
                      <button className="icon-button" type="button" title="编辑" onClick={() => startEdit(member)}>
                        <Edit3 size={16} />
                      </button>
                      <button className="icon-button" type="button" title="删除" onClick={() => void removeMember(member)}>
                        <Trash2 size={16} />
                      </button>
                    </span>
                  </article>
                ))
              )}
            </div>

            {totalPages > 1 && (
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            )}
          </section>

          <aside className="detail-dashboard">
            <article className="metric">
              <span>家族成员数</span>
              <strong>{family.memberCount.toLocaleString()}</strong>
            </article>

            <div className="gender-card">
              <span className="gender-card-label">男女比例</span>
              <div
                className="pie-chart"
                style={{
                  background: genderStats.total > 0
                    ? `conic-gradient(#111111 0deg ${malePct * 3.6}deg, #e0e0e0 ${malePct * 3.6}deg 360deg)`
                    : "#f0f0f0"
                }}
              />
              <div className="gender-legend">
                <div className="gender-item">
                  <span className="gender-dot male-dot" />
                  <span>男</span>
                  <strong>{genderStats.male}</strong>
                  <span className="gender-pct">{malePct}%</span>
                </div>
                <div className="gender-item">
                  <span className="gender-dot female-dot" />
                  <span>女</span>
                  <strong>{genderStats.female}</strong>
                  <span className="gender-pct">{femalePct}%</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
          </>
        )}
      </section>

      {memberModalOpen && (
        <div className="modal-backdrop" onMouseDown={cancelEdit}>
          <form className="modal-panel" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
            <div className="panel-heading modal-heading">
              <h2>{editing ? "编辑成员" : "新增成员"}</h2>
              <button className="icon-button" type="button" title="关闭" onClick={cancelEdit}>
                <X size={17} />
              </button>
            </div>
            <div className="form-body">
              <label>
                <span>姓名</span>
                <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </label>
              <div className="form-pair">
                <label>
                  <span>性别</span>
                  <select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value as Gender })}>
                    <option value="M">男</option>
                    <option value="F">女</option>
                  </select>
                </label>
                <label>
                  <span>代数</span>
                  <input
                    required
                    inputMode="numeric"
                    value={form.generation}
                    onChange={(event) => setForm({ ...form, generation: event.target.value })}
                  />
                </label>
              </div>
              <div className="form-pair">
                <label>
                  <span>出生年份</span>
                  <input inputMode="numeric" value={form.birthYear} onChange={(event) => setForm({ ...form, birthYear: event.target.value })} />
                </label>
                <label>
                  <span>死亡年份</span>
                  <input inputMode="numeric" value={form.deathYear} onChange={(event) => setForm({ ...form, deathYear: event.target.value })} />
                </label>
              </div>
              <div className="form-pair">
                <label>
                  <span>父亲 ID</span>
                  <input inputMode="numeric" value={form.fatherId} onChange={(event) => setForm({ ...form, fatherId: event.target.value })} />
                </label>
                <label>
                  <span>母亲 ID</span>
                  <input inputMode="numeric" value={form.motherId} onChange={(event) => setForm({ ...form, motherId: event.target.value })} />
                </label>
              </div>
              <label>
                <span>配偶 ID</span>
                <input inputMode="numeric" value={form.spouseId} onChange={(event) => setForm({ ...form, spouseId: event.target.value })} />
              </label>
              <label>
                <span>籍贯</span>
                <input value={form.birthplace} onChange={(event) => setForm({ ...form, birthplace: event.target.value })} />
              </label>
              <label>
                <span>备注</span>
                <textarea value={form.biography} onChange={(event) => setForm({ ...form, biography: event.target.value })} />
              </label>
              {error && <p className="error-text">{error}</p>}
              <button className="primary-button wide-button" type="submit">
                <Save size={18} />
                <span>{editing ? "保存成员" : "新增成员"}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
