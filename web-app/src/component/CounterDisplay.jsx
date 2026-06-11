import { useAtom } from 'jotai'
import { countAtom } from '../store.ts'

function CounterDisplay() {
  const [count, setCount] = useAtom(countAtom)

  return (
    <div className="card">
      <h2>Another Component</h2>
      <p>Count: {count}</p>
      <button onClick={() => setCount((c) => c + 1)}>
        Increment from another component
      </button>
    </div>
  )
}

export default CounterDisplay
