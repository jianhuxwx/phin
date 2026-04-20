import ArnsList from '@/components/arns/ArnsList'

export default function ArnsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-tx-primary mb-1">ArNS Explorer</h1>
        <p className="text-tx-muted text-sm">
          Browse and search Arweave Name System records.
        </p>
      </div>
      <ArnsList />
    </div>
  )
}
