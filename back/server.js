const express = require('express')
const { ReclaimProofRequest, verifyProof } = require('@reclaimprotocol/js-sdk')
 
const app = express()
const port = 3000
 
app.use(express.json())
app.use(express.text({ type: '*/*', limit: '50mb' })) // This is to parse the urlencoded proof object that is returned to the callback url
 
// Route to generate SDK configuration
app.get('/reclaim/generate-config', async (req, res) => {
    const APP_ID = process.env.REACT_APP_RECLAIM_APP_ID;
    const APP_SECRET = process.env.REACT_APP_RECLAIM_APP_SECRET;
    const PROVIDER_ID = process.env.REACT_APP_RECLAIM_PROVIDER_ID;
 
  try {
    const reclaimProofRequest = await ReclaimProofRequest.init(APP_ID, APP_SECRET, PROVIDER_ID)
    
    reclaimProofRequest.setAppCallbackUrl('https://your-backend.com/receive-proofs')
    
    const reclaimProofRequestConfig = reclaimProofRequest.toJsonString()
 
    return res.json({ reclaimProofRequestConfig })
  } catch (error) {
    console.error('Error generating request config:', error)
    return res.status(500).json({ error: 'Failed to generate request config' })
  }
})
 
// Route to receive proofs
app.post('/receive-proofs', async (req, res) => {
  // decode the urlencoded proof object
  const decodedBody = decodeURIComponent(req.body);
  const proof = JSON.parse(decodedBody);
 
  // Verify the proof using the SDK verifyProof function
  const result = await verifyProof(proof)
  if (!result) {
    return res.status(400).json({ error: 'Invalid proofs data' });
  }
 
  console.log('Received proofs:', proof)
  // Process the proofs here
  return res.sendStatus(200)
})
 
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
})