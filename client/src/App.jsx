import { useState } from 'react'
import './App.css'

function App() {
  const [inputValue, setInputValue] = useState('')

  const handleSubmit = async () => {
    try {
      const response = await fetch('http://localhost:3000/createvideo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: inputValue, id: 23 }),
      })

      const result = await response.json()
      console.log('Server response:', result)
    } catch (error) {
      console.error('Error sending request:', error)
    }
  }

  return (
    <div className="App">
      <input
        type="text"
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        placeholder="Enter data"
      />
      <button onClick={handleSubmit}>Send</button>
      <h1 className='text-orange-900 text-9xl'>hello world</h1>
    </div>
  )
}

export default App
