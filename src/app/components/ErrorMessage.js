// src/components/ErrorMessage.js
export default function ErrorMessage({ title, description, backHref }) {
    return (
      <main className="min-h-screen flex items-center justify-center text-center px-6 bg-[#f4f1ec] text-[#5a4a3f]">
        <div>
          <h1 className="text-3xl font-serif mb-4">{title}</h1>
          <p className="text-lg mb-6">{description}</p>
          <LinkWithLoader href={backHref || '/'}>
            <button className="bg-[#8b6f47] text-white px-6 py-3 rounded-full font-medium hover:bg-[#a78b62] transition-all">
              Go Back
            </button>
          </LinkWithLoader>
        </div>
      </main>
    );
  }
  