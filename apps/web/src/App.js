import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowLeft, Check, Edit3, Inbox, LogIn, LogOut, Plus, Save, Search, Trash2, UserRound, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "./lib/api";
const emptyFamilyForm = {
    familyName: "",
    surname: "",
    description: ""
};
const emptyMemberForm = {
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
function toOptionalNumber(value) {
    const trimmed = value.trim();
    return trimmed === "" ? null : Number(trimmed);
}
function familyToForm(family) {
    return {
        familyName: family.familyName,
        surname: family.surname,
        description: family.description ?? ""
    };
}
function memberToForm(member) {
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
function formatDate(value) {
    if (!value)
        return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return value.slice(0, 16);
    return date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}
export function App() {
    const [token, setToken] = useState(() => localStorage.getItem("genealogy-token") ?? "");
    const [user, setUser] = useState(() => {
        const raw = localStorage.getItem("genealogy-user");
        return raw ? JSON.parse(raw) : null;
    });
    const [selectedFamily, setSelectedFamily] = useState(null);
    const [familyRefreshKey, setFamilyRefreshKey] = useState(0);
    function handleLogin(nextToken, nextUser) {
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
        return _jsx(LoginPage, { onLogin: handleLogin });
    }
    return (_jsx(AppFrame, { user: user, token: token, onLogout: handleLogout, onInvitationsChanged: () => setFamilyRefreshKey((value) => value + 1), children: selectedFamily ? (_jsx(MembersPage, { family: selectedFamily, token: token, refreshKey: familyRefreshKey, onBack: () => setSelectedFamily(null), onSelectFamily: setSelectedFamily })) : (_jsx(FamiliesPage, { token: token, refreshKey: familyRefreshKey, onOpenFamily: setSelectedFamily })) }));
}
function LoginPage({ onLogin }) {
    const [mode, setMode] = useState("login");
    const [usernameOrEmail, setUsernameOrEmail] = useState("admin");
    const [password, setPassword] = useState("admin123");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    async function submit(event) {
        event.preventDefault();
        setError("");
        setLoading(true);
        try {
            if (mode === "register" && password !== confirmPassword) {
                setError("两次输入的密码不一致");
                return;
            }
            const result = await apiRequest(mode === "login" ? "/auth/login" : "/auth/register", {
                method: "POST",
                body: JSON.stringify(mode === "login"
                    ? { usernameOrEmail, password }
                    : { username: usernameOrEmail, password, confirmPassword })
            });
            onLogin(result.token, result.user);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "登录失败");
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx("main", { className: "login-page", children: _jsxs("form", { className: "login-panel", onSubmit: submit, children: [_jsxs("div", { className: "brand login-brand", children: [_jsx("div", { className: "brand-mark", children: "\u8C31" }), _jsxs("div", { children: [_jsx("strong", { children: "\u65CF\u8C31\u7BA1\u7406\u7CFB\u7EDF" }), _jsx("span", { children: "PostgreSQL" })] })] }), _jsxs("div", { className: "auth-tabs", role: "tablist", "aria-label": "\u8D26\u53F7\u5165\u53E3", children: [_jsx("button", { className: mode === "login" ? "active" : "", type: "button", onClick: () => {
                                setMode("login");
                                setUsernameOrEmail("admin");
                                setPassword("admin123");
                                setConfirmPassword("");
                                setError("");
                            }, children: "\u767B\u5F55" }), _jsx("button", { className: mode === "register" ? "active" : "", type: "button", onClick: () => {
                                setMode("register");
                                setUsernameOrEmail("");
                                setPassword("");
                                setConfirmPassword("");
                                setError("");
                            }, children: "\u6CE8\u518C" })] }), _jsxs("div", { className: "form-stack", children: [_jsxs("label", { children: [_jsx("span", { children: "\u8D26\u53F7" }), _jsx("input", { value: usernameOrEmail, onChange: (event) => setUsernameOrEmail(event.target.value) })] }), _jsxs("label", { children: [_jsx("span", { children: "\u5BC6\u7801" }), _jsx("input", { type: "password", value: password, onChange: (event) => setPassword(event.target.value) })] }), mode === "register" && (_jsxs("label", { children: [_jsx("span", { children: "\u786E\u8BA4\u5BC6\u7801" }), _jsx("input", { type: "password", value: confirmPassword, onChange: (event) => setConfirmPassword(event.target.value) })] }))] }), mode === "login" && (_jsxs("div", { className: "test-account", children: [_jsx("span", { children: "\u6D4B\u8BD5\u8D26\u53F7" }), _jsx("strong", { children: "admin / admin123" })] })), error && _jsx("p", { className: "error-text", children: error }), _jsxs("button", { className: "primary-button wide-button", type: "submit", disabled: loading, children: [_jsx(LogIn, { size: 18 }), _jsx("span", { children: loading ? (mode === "login" ? "登录中" : "注册中") : mode === "login" ? "登录" : "注册并进入" })] })] }) }));
}
function AppFrame({ user, token, onLogout, onInvitationsChanged, children }) {
    const [open, setOpen] = useState(false);
    const [invitations, setInvitations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    async function loadInvitations() {
        setLoading(true);
        setMessage("");
        try {
            const result = await apiRequest("/invitations", { token });
            setInvitations(result.data);
        }
        catch (err) {
            setMessage(err instanceof Error ? err.message : "加载邀请失败");
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        void loadInvitations();
    }, [token]);
    async function handleInvitation(invitation, action) {
        setMessage("");
        try {
            await apiRequest(`/invitations/${invitation.invitationId}`, {
                method: "PATCH",
                token,
                body: JSON.stringify({ action })
            });
            await loadInvitations();
            onInvitationsChanged();
        }
        catch (err) {
            setMessage(err instanceof Error ? err.message : "处理邀请失败");
        }
    }
    return (_jsxs("div", { className: "app-frame", children: [_jsxs("header", { className: "app-header", children: [_jsxs("div", { className: "brand", children: [_jsx("div", { className: "brand-mark", children: "\u8C31" }), _jsxs("div", { children: [_jsx("strong", { children: "\u65CF\u8C31\u7BA1\u7406\u7CFB\u7EDF" }), _jsx("span", { children: user.username })] })] }), _jsxs("div", { className: "header-actions", children: [_jsxs("div", { className: "mailbox", children: [_jsxs("button", { className: "icon-button", type: "button", title: "\u9080\u8BF7\u4FE1\u7BB1", onClick: () => setOpen((value) => !value), children: [_jsx(Inbox, { size: 18 }), invitations.length > 0 && _jsx("span", { className: "badge", children: invitations.length })] }), open && (_jsxs("div", { className: "mailbox-popover", children: [_jsxs("div", { className: "mailbox-heading", children: [_jsx("strong", { children: "\u9080\u8BF7\u7533\u8BF7" }), _jsx("button", { className: "icon-button small-icon-button", type: "button", title: "\u5173\u95ED", onClick: () => setOpen(false), children: _jsx(X, { size: 15 }) })] }), message && _jsx("p", { className: "error-text", children: message }), _jsx("div", { className: "invitation-list", children: loading ? (_jsx("div", { className: "empty-state compact-empty", children: "\u52A0\u8F7D\u4E2D" })) : invitations.length === 0 ? (_jsx("div", { className: "empty-state compact-empty", children: "\u6682\u65E0\u9080\u8BF7" })) : (invitations.map((invitation) => (_jsxs("article", { className: "invitation-item", children: [_jsxs("div", { children: [_jsx("strong", { children: invitation.familyName }), _jsxs("span", { children: [invitation.inviterUsername, " \u9080\u8BF7\u4F60\u52A0\u5165 ", invitation.surname, "\u6C0F\u65CF\u8C31"] })] }), _jsxs("div", { className: "invitation-actions", children: [_jsxs("button", { className: "primary-button small-action-button", type: "button", onClick: () => void handleInvitation(invitation, "accept"), children: [_jsx(Check, { size: 15 }), _jsx("span", { children: "\u786E\u8BA4" })] }), _jsxs("button", { className: "ghost-button small-action-button", type: "button", onClick: () => void handleInvitation(invitation, "reject"), children: [_jsx(X, { size: 15 }), _jsx("span", { children: "\u53D6\u6D88" })] })] })] }, invitation.invitationId)))) })] }))] }), _jsxs("button", { className: "ghost-button", type: "button", onClick: onLogout, children: [_jsx(LogOut, { size: 18 }), _jsx("span", { children: "\u9000\u51FA\u767B\u5F55" })] })] })] }), _jsx("main", { className: "app-content", children: children })] }));
}
function FamiliesPage({ token, refreshKey, onOpenFamily }) {
    const [families, setFamilies] = useState([]);
    const [form, setForm] = useState(emptyFamilyForm);
    const [editing, setEditing] = useState(null);
    const [familyModalOpen, setFamilyModalOpen] = useState(false);
    const [inviteTarget, setInviteTarget] = useState(null);
    const [inviteUsername, setInviteUsername] = useState("");
    const [inviteMessage, setInviteMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    async function loadFamilies() {
        setLoading(true);
        setError("");
        try {
            const result = await apiRequest("/families", { token });
            setFamilies(result.data);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "加载失败");
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        void loadFamilies();
    }, [token, refreshKey]);
    async function submit(event) {
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
            }
            else {
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
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "保存失败");
        }
    }
    async function removeFamily(event, family) {
        event.stopPropagation();
        if (!window.confirm(`删除 ${family.familyName}？`))
            return;
        await apiRequest(`/families/${family.familyId}`, { method: "DELETE", token });
        await loadFamilies();
    }
    function startEdit(event, family) {
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
    function startInvite(event, family) {
        event.stopPropagation();
        setInviteTarget(family);
        setInviteUsername("");
        setInviteMessage("");
    }
    async function submitInvite(event) {
        event.preventDefault();
        if (!inviteTarget)
            return;
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
        }
        catch (err) {
            setInviteMessage(err instanceof Error ? err.message : "邀请失败");
        }
    }
    function cancelEdit() {
        setEditing(null);
        setForm({ ...emptyFamilyForm });
        setError("");
        setFamilyModalOpen(false);
    }
    const totalMembers = useMemo(() => families.reduce((sum, family) => sum + family.memberCount, 0), [families]);
    return (_jsxs("div", { className: "home-workspace", children: [_jsx("header", { className: "topbar", children: _jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "\u9996\u9875" }), _jsx("h1", { children: "\u65CF\u8C31\u7BA1\u7406" })] }) }), _jsxs("section", { className: "stats-grid", "aria-label": "\u65CF\u8C31\u6982\u89C8", children: [_jsxs("article", { className: "metric", children: [_jsx("span", { children: "\u65CF\u8C31\u6570\u91CF" }), _jsx("strong", { children: families.length })] }), _jsxs("article", { className: "metric", children: [_jsx("span", { children: "\u6210\u5458\u603B\u6570" }), _jsx("strong", { children: totalMembers.toLocaleString() })] }), _jsxs("article", { className: "metric", children: [_jsx("span", { children: "\u6700\u5927\u65CF\u8C31" }), _jsx("strong", { children: Math.max(0, ...families.map((family) => family.memberCount)).toLocaleString() })] })] }), _jsx("section", { className: "home-family-section", children: _jsxs("section", { className: "panel list-panel", children: [_jsxs("div", { className: "panel-heading", children: [_jsx("h2", { children: "\u5168\u90E8\u65CF\u8C31" }), _jsxs("div", { className: "panel-actions", children: [_jsxs("button", { className: "primary-button", type: "button", onClick: startCreate, children: [_jsx(Plus, { size: 16 }), _jsx("span", { children: "\u521B\u5EFA\u65CF\u8C31" })] }), _jsxs("button", { className: "ghost-button", type: "button", onClick: () => void loadFamilies(), children: [_jsx(Search, { size: 16 }), _jsx("span", { children: "\u5237\u65B0" })] })] })] }), _jsx("div", { className: "family-list", children: loading ? (_jsx("div", { className: "empty-state", children: "\u52A0\u8F7D\u4E2D" })) : (families.map((family) => (_jsxs("article", { className: "family-row", role: "button", tabIndex: 0, onClick: () => onOpenFamily(family), onKeyDown: (event) => {
                                    if (event.key === "Enter")
                                        onOpenFamily(family);
                                }, children: [_jsx("span", { className: "family-mark", children: family.surname }), _jsxs("span", { className: "family-main", children: [_jsx("strong", { children: family.familyName }), _jsx("span", { children: family.description }), _jsxs("span", { children: ["\u6700\u65B0\u4FEE\u6539 ", formatDate(family.revisionTime), " \u00B7 \u521B\u5EFA\u7528\u6237 ", family.createdByUsername] })] }), _jsxs("span", { className: "family-count", children: [family.memberCount.toLocaleString(), " \u4EBA"] }), _jsxs("span", { className: "row-actions", children: [_jsx("button", { className: "icon-button", type: "button", title: "\u7F16\u8F91", onClick: (event) => startEdit(event, family), children: _jsx(Edit3, { size: 16 }) }), _jsx("button", { className: "icon-button", type: "button", title: "\u9080\u8BF7\u7528\u6237", onClick: (event) => startInvite(event, family), children: _jsx(UserPlus, { size: 16 }) }), _jsx("button", { className: "icon-button", type: "button", title: "\u5220\u9664", onClick: (event) => void removeFamily(event, family), children: _jsx(Trash2, { size: 16 }) })] })] }, family.familyId)))) })] }) }), familyModalOpen && (_jsx("div", { className: "modal-backdrop", onMouseDown: cancelEdit, children: _jsxs("form", { className: "modal-panel", onSubmit: submit, onMouseDown: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "panel-heading modal-heading", children: [_jsx("h2", { children: editing ? "编辑族谱" : "创建族谱" }), _jsx("button", { className: "icon-button", type: "button", title: "\u5173\u95ED", onClick: cancelEdit, children: _jsx(X, { size: 17 }) })] }), _jsxs("div", { className: "form-body", children: [_jsxs("label", { children: [_jsx("span", { children: "\u65CF\u8C31\u540D\u79F0" }), _jsx("input", { required: true, value: form.familyName, onChange: (event) => setForm({ ...form, familyName: event.target.value }) })] }), _jsxs("label", { children: [_jsx("span", { children: "\u59D3\u6C0F" }), _jsx("input", { required: true, value: form.surname, onChange: (event) => setForm({ ...form, surname: event.target.value }) })] }), _jsxs("label", { children: [_jsx("span", { children: "\u63CF\u8FF0" }), _jsx("textarea", { value: form.description, onChange: (event) => setForm({ ...form, description: event.target.value }) })] }), error && _jsx("p", { className: "error-text", children: error }), _jsxs("button", { className: "primary-button wide-button", type: "submit", children: [_jsx(Save, { size: 18 }), _jsx("span", { children: editing ? "保存修改" : "创建族谱" })] })] })] }) })), inviteTarget && (_jsx("div", { className: "modal-backdrop", onMouseDown: () => setInviteTarget(null), children: _jsxs("form", { className: "modal-panel", onSubmit: submitInvite, onMouseDown: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "panel-heading modal-heading", children: [_jsx("h2", { children: "\u9080\u8BF7\u7528\u6237" }), _jsx("button", { className: "icon-button", type: "button", title: "\u5173\u95ED", onClick: () => setInviteTarget(null), children: _jsx(X, { size: 17 }) })] }), _jsxs("div", { className: "form-body", children: [_jsxs("p", { className: "modal-note", children: ["\u9080\u8BF7\u5BF9\u65B9\u52A0\u5165 ", inviteTarget.familyName] }), _jsxs("label", { children: [_jsx("span", { children: "\u7528\u6237\u8D26\u53F7" }), _jsx("input", { required: true, value: inviteUsername, onChange: (event) => setInviteUsername(event.target.value), placeholder: "\u4F8B\u5982 guest" })] }), inviteMessage && _jsx("p", { className: "error-text", children: inviteMessage }), _jsxs("button", { className: "primary-button wide-button", type: "submit", children: [_jsx(UserPlus, { size: 18 }), _jsx("span", { children: "\u53D1\u9001\u9080\u8BF7" })] })] })] }) }))] }));
}
function MembersPage({ family, token, refreshKey, onBack, onSelectFamily }) {
    const [families, setFamilies] = useState([]);
    const [members, setMembers] = useState([]);
    const [keyword, setKeyword] = useState("");
    const [generation, setGeneration] = useState("");
    const [form, setForm] = useState({ ...emptyMemberForm, generation: "1" });
    const [editing, setEditing] = useState(null);
    const [loading, setLoading] = useState(true);
    const [familyLoading, setFamilyLoading] = useState(true);
    const [error, setError] = useState("");
    async function loadFamilySidebar() {
        setFamilyLoading(true);
        try {
            const result = await apiRequest("/families", { token });
            setFamilies(result.data);
        }
        catch {
            setFamilies([]);
        }
        finally {
            setFamilyLoading(false);
        }
    }
    async function loadMembers() {
        setLoading(true);
        setError("");
        const params = new URLSearchParams({
            familyId: String(family.familyId),
            limit: "80"
        });
        if (keyword.trim())
            params.set("q", keyword.trim());
        if (generation.trim())
            params.set("generation", generation.trim());
        try {
            const result = await apiRequest(`/members?${params.toString()}`, { token });
            setMembers(result.data);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "加载失败");
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        void loadFamilySidebar();
    }, [token, refreshKey]);
    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadMembers();
        }, 220);
        return () => window.clearTimeout(timer);
    }, [family.familyId, keyword, generation]);
    async function submit(event) {
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
            }
            else {
                await apiRequest("/members", {
                    method: "POST",
                    token,
                    body: JSON.stringify(payload)
                });
            }
            setEditing(null);
            setForm({ ...emptyMemberForm });
            await loadMembers();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "保存失败");
        }
    }
    async function removeMember(member) {
        if (!window.confirm(`删除 ${member.name}？`))
            return;
        await apiRequest(`/members/${member.memberId}`, { method: "DELETE", token });
        await loadMembers();
    }
    function startEdit(member) {
        setEditing(member);
        setForm(memberToForm(member));
    }
    function cancelEdit() {
        setEditing(null);
        setForm({ ...emptyMemberForm });
        setError("");
    }
    function switchFamily(nextFamily) {
        onSelectFamily(nextFamily);
        setKeyword("");
        setGeneration("");
        setEditing(null);
        setForm({ ...emptyMemberForm });
        setError("");
    }
    return (_jsxs("div", { className: "detail-shell", children: [_jsxs("aside", { className: "family-sidebar", children: [_jsxs("div", { className: "side-heading", children: [_jsx("button", { className: "icon-button", type: "button", title: "\u8FD4\u56DE\u9996\u9875", onClick: onBack, children: _jsx(ArrowLeft, { size: 17 }) }), _jsxs("div", { children: [_jsx("span", { children: "\u65CF\u8C31\u6761\u76EE" }), _jsx("strong", { children: "\u5168\u90E8\u65CF\u8C31" })] })] }), _jsx("div", { className: "side-family-list", children: familyLoading ? (_jsx("div", { className: "side-empty", children: "\u52A0\u8F7D\u4E2D" })) : (families.map((item) => (_jsxs("button", { className: `side-family-item ${item.familyId === family.familyId ? "active" : ""}`, type: "button", onClick: () => switchFamily(item), children: [_jsx("span", { className: "side-family-mark", children: item.surname }), _jsxs("span", { className: "side-family-main", children: [_jsx("strong", { children: item.familyName }), _jsxs("span", { children: [item.memberCount.toLocaleString(), " \u4EBA"] })] })] }, item.familyId)))) })] }), _jsxs("section", { className: "detail-workspace", children: [_jsx("header", { className: "topbar", children: _jsx("div", { className: "title-row", children: _jsxs("div", { children: [_jsxs("p", { className: "eyebrow", children: [family.surname, "\u6C0F"] }), _jsx("h1", { children: family.familyName })] }) }) }), _jsxs("section", { className: "toolbar", "aria-label": "\u6210\u5458\u7B5B\u9009", children: [_jsxs("label", { className: "search-box", children: [_jsx(Search, { size: 18 }), _jsx("input", { value: keyword, onChange: (event) => setKeyword(event.target.value), placeholder: "\u641C\u7D22\u59D3\u540D" })] }), _jsx("input", { className: "generation-input", value: generation, onChange: (event) => setGeneration(event.target.value), placeholder: "\u4EE3\u6570", inputMode: "numeric" })] }), _jsxs("section", { className: "management-grid members-grid", children: [_jsxs("form", { className: "panel form-panel", onSubmit: submit, children: [_jsxs("div", { className: "panel-heading", children: [_jsx("h2", { children: editing ? "编辑成员" : "新增成员" }), editing && (_jsx("button", { className: "icon-button", type: "button", title: "\u53D6\u6D88", onClick: cancelEdit, children: _jsx(X, { size: 17 }) }))] }), _jsxs("div", { className: "form-body", children: [_jsxs("label", { children: [_jsx("span", { children: "\u59D3\u540D" }), _jsx("input", { required: true, value: form.name, onChange: (event) => setForm({ ...form, name: event.target.value }) })] }), _jsxs("div", { className: "form-pair", children: [_jsxs("label", { children: [_jsx("span", { children: "\u6027\u522B" }), _jsxs("select", { value: form.gender, onChange: (event) => setForm({ ...form, gender: event.target.value }), children: [_jsx("option", { value: "M", children: "\u7537" }), _jsx("option", { value: "F", children: "\u5973" })] })] }), _jsxs("label", { children: [_jsx("span", { children: "\u4EE3\u6570" }), _jsx("input", { required: true, inputMode: "numeric", value: form.generation, onChange: (event) => setForm({ ...form, generation: event.target.value }) })] })] }), _jsxs("div", { className: "form-pair", children: [_jsxs("label", { children: [_jsx("span", { children: "\u51FA\u751F\u5E74\u4EFD" }), _jsx("input", { inputMode: "numeric", value: form.birthYear, onChange: (event) => setForm({ ...form, birthYear: event.target.value }) })] }), _jsxs("label", { children: [_jsx("span", { children: "\u6B7B\u4EA1\u5E74\u4EFD" }), _jsx("input", { inputMode: "numeric", value: form.deathYear, onChange: (event) => setForm({ ...form, deathYear: event.target.value }) })] })] }), _jsxs("div", { className: "form-pair", children: [_jsxs("label", { children: [_jsx("span", { children: "\u7236\u4EB2 ID" }), _jsx("input", { inputMode: "numeric", value: form.fatherId, onChange: (event) => setForm({ ...form, fatherId: event.target.value }) })] }), _jsxs("label", { children: [_jsx("span", { children: "\u6BCD\u4EB2 ID" }), _jsx("input", { inputMode: "numeric", value: form.motherId, onChange: (event) => setForm({ ...form, motherId: event.target.value }) })] })] }), _jsxs("label", { children: [_jsx("span", { children: "\u914D\u5076 ID" }), _jsx("input", { inputMode: "numeric", value: form.spouseId, onChange: (event) => setForm({ ...form, spouseId: event.target.value }) })] }), _jsxs("label", { children: [_jsx("span", { children: "\u7C4D\u8D2F" }), _jsx("input", { value: form.birthplace, onChange: (event) => setForm({ ...form, birthplace: event.target.value }) })] }), _jsxs("label", { children: [_jsx("span", { children: "\u5907\u6CE8" }), _jsx("textarea", { value: form.biography, onChange: (event) => setForm({ ...form, biography: event.target.value }) })] }), error && _jsx("p", { className: "error-text", children: error }), _jsxs("button", { className: "primary-button wide-button", type: "submit", children: [_jsx(Save, { size: 18 }), _jsx("span", { children: editing ? "保存成员" : "新增成员" })] })] })] }), _jsxs("section", { className: "panel list-panel", children: [_jsxs("div", { className: "panel-heading", children: [_jsx("h2", { children: "\u6210\u5458\u5217\u8868" }), _jsxs("span", { className: "list-count", children: [members.length, " \u6761"] })] }), _jsx("div", { className: "member-list", children: loading ? (_jsx("div", { className: "empty-state", children: "\u52A0\u8F7D\u4E2D" })) : (members.map((member) => (_jsxs("article", { className: "member-row", children: [_jsx("span", { className: "avatar", children: _jsx(UserRound, { size: 18 }) }), _jsxs("span", { className: "member-main", children: [_jsx("strong", { children: member.name }), _jsxs("span", { children: ["ID ", member.memberId, " \u00B7 \u7B2C ", member.generation, " \u4EE3 \u00B7 ", member.gender === "M" ? "男" : "女"] })] }), _jsxs("span", { className: "member-years", children: [member.birthYear ?? "-", " / ", member.deathYear ?? "-"] }), _jsxs("span", { className: "row-actions", children: [_jsx("button", { className: "icon-button", type: "button", title: "\u7F16\u8F91", onClick: () => startEdit(member), children: _jsx(Edit3, { size: 16 }) }), _jsx("button", { className: "icon-button", type: "button", title: "\u5220\u9664", onClick: () => void removeMember(member), children: _jsx(Trash2, { size: 16 }) })] })] }, member.memberId)))) })] })] })] })] }));
}
