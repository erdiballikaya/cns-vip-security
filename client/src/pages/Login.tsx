import { useState } from "react";
import { http } from "../api/http";
import TextField from "../components/TextField";
import Button from "../components/Button";
import Toast from "../components/Toast";
import "../styles/auth.css";

export default function Login() {
  const [email, setEmail] = useState("admin@cns.com");
  const [password, setPassword] = useState("123456");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ t: string; m: string } | null>(null);

  const login = async () => {
    setBusy(true);
    try {
      const res = await http.post("/auth/login", { email, password });
      localStorage.setItem("token", res.data.token);
      window.location.href = "/";
    } catch (e: any) {
      setToast({
        t: "Giriş başarısız",
        m: e?.response?.data?.message ?? "Bilgileri kontrol et.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="authWrap">
        <div className="authLeft">
          <div className="authHero">
            <div className="brandRow">
              <div className="brandMark" />
              <div>
                <div className="brandName">CNS VIP GÜVENLİK</div>
                <div className="heroSub">Operasyon · Yetki · Saha Yönetimi</div>
              </div>
            </div>

            <div className="heroTitle">Sahadaki ekibi tek panelden yönetin.</div>
            <div className="heroSub">
              Site bazlı yönetim, dinamik formlar, denetim kayıtları ve raporlama.
            </div>

            <div className="heroStats">
              <div className="stat"><b>Roller</b><span>Admin · Manager · Personel</span></div>
              <div className="stat"><b>Modüller</b><span>Dinamik yetkilendirme</span></div>
              <div className="stat"><b>Formlar</b><span>Sayfa bazlı alan yönetimi</span></div>
            </div>
          </div>
        </div>

        <div className="authRight">
          <div className="card">
            <div className="cardHead">
              <div>
                <div className="cardTitle">Panele Giriş</div>
                <div className="cardSub">E-posta ve şifren ile devam et</div>
              </div>
            </div>

            <div className="cardBody">
              <TextField
                label="E-posta"
                type="email"
                autoComplete="email"
                placeholder="ornek@cnsvipguvenlik.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <TextField
                label="Şifre"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <div className="row">
                <a
                  className="link"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setToast({ t: "Yakında", m: "Şifre sıfırlama akışını ekleyeceğiz." });
                  }}
                >
                  Şifremi unuttum
                </a>

                <Button variant="primary" disabled={busy} onClick={login}>
                  {busy ? "Giriş yapılıyor..." : "Giriş Yap"}
                </Button>
              </div>

              <div className="divider" />
              <div className="small">
                Bu panel kurumsal kullanım içindir.
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast title={toast.t} message={toast.m} onClose={() => setToast(null)} />}
    </>
  );
}
