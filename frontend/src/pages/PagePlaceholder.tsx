export default function PagePlaceholder({ title }: { title: string }) {
  return (
    <div className="page">
      <section className="card">
        <h2>{title}</h2>
        <p>
          Este módulo se implementará en una fase posterior del plan.
        </p>
      </section>
    </div>
  )
}