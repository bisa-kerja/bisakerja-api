# Module Development Standards (`src/modules/`)

Dokumen ini adalah standar implementasi modul backend Bisakerja agar struktur file, pembagian tanggung jawab, dan gaya implementasi tetap konsisten lintas modul.

## Tujuan

1. Menyamakan struktur setiap modul.
2. Memisahkan tanggung jawab antar-layer (route, controller, service, repository, dan lainnya).
3. Memudahkan onboarding engineer baru.
4. Menjadi acuan tunggal saat membuat modul baru.

## Struktur Standar Modul

Gunakan struktur berikut sebagai default:

```text
src/modules/<module>/
  <module>.route.ts
  <module>.controller.ts
  <module>.service.ts
  <module>.repository.ts
  <module>.schema.ts
  <module>.types.ts
  <module>.constants.ts
  index.ts
```

Catatan:

- `repository`, `constants`, dan `types` boleh dihilangkan bila memang tidak diperlukan.
- Untuk modul sederhana (seperti `health`), `schema` dapat dihilangkan jika tidak ada payload request.
- `route`, `controller`, dan `service` tetap dipertahankan agar alur layer seragam.

## Peran Setiap Jenis File

| File                     | Peran utama                                                           | Boleh bergantung pada                              | Tidak boleh dilakukan                                            |
| ------------------------ | --------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| `<module>.route.ts`      | Deklarasi endpoint, middleware chain, binding handler                 | `schema`, middleware, controller                   | Menulis business rule, query database                            |
| `<module>.controller.ts` | Menerjemahkan request HTTP ke service call dan membentuk response API | service, response formatter, type request/response | Query Prisma langsung, domain logic berat                        |
| `<module>.service.ts`    | Business rule, orkestrasi use-case, validasi domain, batas transaksi  | repository, shared utils, integration client       | Ketergantungan ke objek Express `req/res`                        |
| `<module>.repository.ts` | Akses data (Prisma), query, mapping hasil persistence                 | Prisma client/type, mapper internal modul          | Memanggil downstream HTTP service, formatting response API       |
| `<module>.schema.ts`     | Kontrak input (Zod) untuk body/query/params                           | `zod` dan helper validasi                          | Menjalankan query, side-effect bisnis                            |
| `<module>.types.ts`      | Kontrak TypeScript lintas file modul                                  | type internal modul/shared                         | Menjadi dumping ground semua type lintas domain                  |
| `<module>.constants.ts`  | Error code, message default, enum/konstanta domain                    | -                                                  | Menyimpan nilai konfigurasi runtime (env)                        |
| `index.ts`               | Public surface modul (export yang boleh dipakai luar modul)           | file modul terkait                                 | Mengekspor detail internal yang tidak perlu dipakai lintas modul |

## Arah Dependency yang Wajib Diikuti

```text
route -> controller -> service -> repository -> prisma
                       |
                       -> integration client / shared utils
```

Aturan:

1. Controller tidak mengakses Prisma langsung.
2. Service tidak menerima `Request`/`Response` Express.
3. Repository tidak tahu format response API.
4. Route hanya merakit middleware + handler.

## Konvensi Naming

- Nama file modul: `<module>.<role>.ts`
- Nama method controller: `verbObject` (`register`, `resetPassword`, `listJobs`)
- Nama method service: nama use-case/domain (`issueSession`, `verifyEmail`)
- Nama method repository: aksi persistence (`findById`, `createRefreshToken`)
- Error code: `UPPER_SNAKE_CASE`

## Kapan Menggunakan Function vs Class

### Gunakan **function** sebagai default

Pilih function ketika:

1. Logika stateless.
2. Tidak butuh lifecycle object.
3. Tidak butuh pewarisan/polymorphism.
4. Tujuan utamanya komposisi utilitas.

Contoh cocok:

- mapper data
- validator helper
- factory controller sederhana
- helper token/cookie/TTL

```ts
export function serializeAuthUser(user: AuthUser) {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt.toISOString()
  };
}
```

### Gunakan **class** ketika benar-benar dibutuhkan

Pilih class ketika:

1. Ada state/dependency yang dipertahankan per instance.
2. Metode-metode berbagi context internal yang sama.
3. Inisialisasi dependency lewat constructor membuat API lebih jelas.
4. Cocok untuk object with behavior (misalnya service besar).

Contoh cocok:

- service dengan banyak use-case yang berbagi `config`, `repository`, `emailProvider`
- controller berbasis instance yang membawa dependency service

```ts
export class AuthService {
  constructor(
    private readonly config: AppConfig,
    private readonly repository: AuthRepository,
    private readonly emailProvider: EmailProvider
  ) {}

  async login(input: LoginInput) {
    // business rule
  }
}
```

### Ringkasan keputusan cepat

| Kondisi                                 | Pilihan  |
| --------------------------------------- | -------- |
| Utility sederhana/stateless             | Function |
| Hanya 1-2 helper murni                  | Function |
| Perlu dependency injection per instance | Class    |
| Banyak method berbagi state/dependency  | Class    |
| Butuh inheritance/polymorphism          | Class    |

## Checklist Saat Membuat Modul Baru

1. Buat file sesuai struktur standar.
2. Definisikan schema request terlebih dahulu.
3. Definisikan types domain modul.
4. Implementasikan service (aturan bisnis) sebelum controller.
5. Implementasikan repository terpisah dari service.
6. Daftarkan route pada `src/modules/index.ts`.
7. Export API publik modul via `index.ts`.
8. Tambahkan/ubah dokumentasi modul pada `docs/modules/`.

## Pola Implementasi yang Sudah Diterapkan (April 2026)

Perbaikan yang sudah diterapkan langsung:

1. Modul `health` kini memiliki `health.controller.ts` agar layer route-controller-service konsisten.
2. `health.route.ts` kini hanya merakit route dan mendelegasikan handler ke controller.
3. `auth.controller.ts` dirapikan dengan helper internal untuk issue context dan format response session.
4. `auth.service.ts` dirapikan dengan helper hasil session agar logic login/refresh lebih mudah dibaca.
