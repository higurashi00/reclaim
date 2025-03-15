const express = require('express')
const { ReclaimProofRequest, verifyProof } = require('@reclaimprotocol/js-sdk')
const fs = require('fs')
const cors = require('cors')
 
const app = express()
const port = 3000
 
app.use(express.json({ limit: '10mb' }))
app.use(express.text({ type: '*/*', limit: '50mb' })) // This is to parse the urlencoded proof object that is returned to the callback url
 
// CORSを詳細に設定
app.use(cors({
  origin: 'http://localhost:3001', // フロントエンドのURL
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // クレデンシャルを許可
}))

// すべてのリクエストをログに記録するミドルウェア
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});
 
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

// プルーフを検証するエンドポイント
app.post('/api/verify-proofs', async (req, res) => {
  console.log('===== フロントエンドからのプルーフ検証開始 =====');
  console.log('リクエストボディ:', req.body);  // リクエストボディをログに出力
  
  try {
    const { proofs } = req.body;
    
    if (!proofs) {
      console.error('プルーフデータがリクエストに含まれていません');
      return res.status(400).json({ error: 'プルーフデータが見つかりません' });
    }
    
    console.log('受信したプルーフデータ構造:', typeof proofs, Array.isArray(proofs) ? 'Array' : 'Object');
    console.log('プルーフデータのキー:', Object.keys(proofs));
    
    // プルーフデータをファイルに保存（デバッグ用）
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    fs.writeFileSync(
      `./frontend-proof-${timestamp}.json`, 
      JSON.stringify(proofs, null, 2)
    );
    console.log(`フロントエンドから受信したプルーフを保存: frontend-proof-${timestamp}.json`);
    
    // プルーフの検証
    console.log('プルーフ検証開始...');
    let verificationResult;
    
    try {
      // Reclaimの検証関数を使用
      verificationResult = await verifyProof(proofs);
      console.log('検証結果:', verificationResult);
    } catch (verifyError) {
      console.error('検証中にエラーが発生:', verifyError);
      return res.status(400).json({ 
        error: '検証エラー', 
        message: verifyError.message,
        verified: false
      });
    }
    
    if (!verificationResult) {
      console.log('プルーフ検証失敗');
      return res.status(400).json({ 
        error: 'プルーフの検証に失敗しました', 
        verified: false 
      });
    }
    
    // ユーザーデータの抽出
    let userData = null;
    
    if (Array.isArray(proofs) && proofs.length > 0 && proofs[0].publicData) {
      userData = {
        username: proofs[0].publicData.username || 'N/A',
        creationYear: proofs[0].publicData.creationYear || 'N/A',
        contributionsLastYear: proofs[0].publicData.contributionsLastYear || 'N/A'
      };
    } else if (proofs.publicData) {
      userData = {
        username: proofs.publicData.username || 'N/A',
        creationYear: proofs.publicData.creationYear || 'N/A',
        contributionsLastYear: proofs.publicData.contributionsLastYear || 'N/A'
      };
    }
    
    console.log('抽出されたユーザーデータ:', userData);
    console.log('===== フロントエンドからのプルーフ検証完了 =====');
    
    return res.json({
      verified: true,
      message: 'プルーフの検証に成功しました',
      userData: userData
    });
    
  } catch (error) {
    console.error('===== プルーフ処理エラー =====');
    console.error('エラー詳細:', error);
    console.error('===== エラー終了 =====');
    return res.status(500).json({ 
      error: 'プルーフの処理中にエラーが発生しました',
      message: error.message,
      verified: false
    });
  }
});

// テスト用エンドポイント
app.get('/api/test', (req, res) => {
  console.log('テストエンドポイントにアクセスがありました');
  res.json({ message: 'サーバーは正常に動作しています' });
});
 
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
})