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

## File Tambahan Yang Diperbolehkan

Beberapa modul membutuhkan file tambahan di luar struktur minimum. Ini boleh dipakai selama naming dan tanggung jawabnya jelas:

- `<module>.mapper.ts`
  - Untuk serializer/resource mapper atau transformasi data murni yang dipakai lebih dari satu layer dalam module yang sama.
- `<module>.utils.ts`
  - Untuk helper murni yang masih spesifik ke module.
- `<module>.<adapter>.ts`
  - Untuk adapter capability yang masih domain-specific, misalnya `auth.email.ts` atau `ai-cv-analyzer.storage.ts`.

Aturan:

1. Jika helper mulai dipakai lintas module, pindahkan ke `src/shared/**` agar tidak membentuk ketergantungan antar module pada file internal module lain.
2. Jangan menambah file “misc”, “helpers”, atau “common” yang menjadi dumping ground. Nama file harus menjelaskan responsibility tunggalnya.
3. `index.ts` hanya mengekspor public API yang memang dibutuhkan dari luar module. Jangan mengekspor controller/helper internal tanpa alasan jelas.
4. Controller class, route-only middleware helper, dan validator wiring internal tidak diekspor dari `index.ts`.
5. Pure helper dari service boleh diekspor hanya jika memang dipakai oleh test, script, atau consumer lintas module yang sah.
6. Vocabulary domain bersama seperti enum/allowed values yang dipakai lintas module atau oleh `src/shared/**` harus dipusatkan di `src/shared/constants/**`, bukan diduplikasi di beberapa module.
7. Helper generik seperti normalisasi teks, filter serialization, atau presenter yang sudah dipakai lintas module harus dipusatkan di `src/shared/utils/**`.

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
5. Controller tidak mengakses repository langsung, termasuk hanya untuk kebutuhan audit/logging. Jika controller butuh metadata domain tambahan, service harus mengembalikannya.

## Konvensi Naming

- Nama file modul: `<module>.<role>.ts`
- Nama file tambahan: `<module>.<capability>.ts` untuk adapter/helper khusus domain
- Nama method controller: `verbObject` (`register`, `resetPassword`, `listJobs`)
- Nama method service: nama use-case/domain (`issueSession`, `verifyEmail`)
- Nama method repository: aksi persistence (`findById`, `createRefreshToken`)
- Error code: `UPPER_SNAKE_CASE`
- Nama class repository implementasi: `Prisma<Module>Repository`
- Nama helper serializer: gunakan awalan `serialize*` hanya untuk mapping resource/output yang murni

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

## Guideline Audit Lintas Module

Gunakan checklist ini saat review atau menambah module baru:

1. Route hanya melakukan wiring dependency, middleware, validasi, dan binding handler.
2. Controller hanya mengubah HTTP request menjadi input service, memanggil `response.formatter`, dan mengirim audit event.
3. Service menjadi satu-satunya tempat orkestrasi domain, validasi domain, keputusan status code domain, dan metadata tambahan yang dibutuhkan controller.
4. Repository hanya membaca/menulis persistence dan tidak memanggil integration client atau membentuk response API.
5. Serializer atau mapper yang dipakai lebih dari satu module harus dipromosikan ke `src/shared/**`, bukan diimpor dari module lain lewat file internal.
6. Konstanta domain yang mewakili vocabulary bersama lintas module harus dipusatkan bila reuse mulai muncul; jangan menggandakan literal/enum yang sama di banyak module.
7. Helper normalisasi string, slug, atau filter yang bersifat generik tidak boleh diduplikasi antar module.
8. `index.ts` harus sempit: ekspor route factory, kontrak type utama, dan dependency public yang memang dipakai oleh app/test. Hindari kebocoran implementation detail.
9. Controller dan helper yang hanya dipakai oleh `route.ts` tetap dianggap internal module.
10. Shared layer tidak boleh bergantung pada module constants atau module utils internal. Jika `src/shared/**` membutuhkan vocabulary domain, pindahkan vocabulary itu ke shared constants lebih dulu.

## Pola Implementasi yang Sudah Diterapkan (April 2026)

Perbaikan yang sudah diterapkan langsung:

1. Modul `health` kini memiliki `health.controller.ts` agar layer route-controller-service konsisten.
2. `health.route.ts` kini hanya merakit route dan mendelegasikan handler ke controller.
3. `auth.controller.ts` dirapikan dengan helper internal untuk issue context dan format response session.
4. `auth.service.ts` dirapikan dengan helper hasil session agar logic login/refresh lebih mudah dibaca.
