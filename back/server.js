const express = require('express')
const { ReclaimProofRequest, verifyProof } = require('@reclaimprotocol/js-sdk')
const fs = require('fs')
const cors = require('cors')
const multer = require('multer') // ファイルアップロード処理のためのライブラリ
const path = require('path')
 
const app = express()
const port = 3000

// ファイルアップロード用のストレージ設定
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = './uploads';
    // アップロードディレクトリが存在しない場合は作成
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, 'proof-' + Date.now() + path.extname(file.originalname));
  }
});

// エラーハンドリングを改善したmulter設定
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MBに増加
  fileFilter: function (req, file, cb) {
    // JSON以外のファイルも許可するが、警告を出す
    if (!file.originalname.endsWith('.json')) {
      console.warn('警告: JSONファイル以外がアップロードされました:', file.originalname);
    }
    cb(null, true);
  }
}).single('proofFile'); // .single()を直接チェーンする

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
  if (req.method === 'POST' && (req.url === '/api/verify-proofs' || req.url === '/api/upload-verify-proofs')) {
    console.log(`コンテントタイプ: ${req.headers['content-type']}`);
    console.log(`ボディサイズ: ${req.headers['content-length'] || '不明'} バイト`);
  }
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

// 既存のプルーフ検証エンドポイントは残しておく
app.post('/api/verify-proofs', async (req, res) => {
  console.log('===== フロントエンドからのプルーフ検証開始 =====');
  console.log('リクエストボディ:', typeof req.body, Object.keys(req.body).length > 0 ? Object.keys(req.body) : 'empty');
  
  try {
    const { proofs } = req.body;
    
    if (!proofs) {
      console.error('プルーフデータがリクエストに含まれていません');
      return res.status(400).json({ error: 'プルーフデータが見つかりません' });
    }
    
    console.log('受信したプルーフデータ構造:', typeof proofs, Array.isArray(proofs) ? 'Array' : 'Object');
    
    // プルーフデータを検証用に正規化
    let normalizedProofs = proofs;
    
    // アップロードしたファイルから取得したプルーフを正規化
    if (typeof proofs === 'object' && !Array.isArray(proofs)) {
      // 必要なプロパティがあるか確認
      const requiredKeys = ['provider', 'parameters', 'context'];
      const hasRequiredKeys = requiredKeys.every(key => proofs.hasOwnProperty(key));
      
      if (!hasRequiredKeys && Array.isArray(proofs.proofs)) {
        normalizedProofs = proofs.proofs;
        console.log('proofs配列を正規化しました');
      } else if (!hasRequiredKeys && proofs[0] && typeof proofs[0] === 'object') {
        normalizedProofs = [proofs[0]];
        console.log('最初のプルーフオブジェクトを使用します');
      }
    }
    
    console.log('正規化後のプルーフデータ構造:', typeof normalizedProofs, Array.isArray(normalizedProofs) ? 'Array' : 'Object');
    console.log('プルーフデータのキー:', Object.keys(normalizedProofs));
    
    // プルーフデータをファイルに保存（デバッグ用）
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    fs.writeFileSync(
      `./debug-proof-${timestamp}.json`, 
      JSON.stringify(normalizedProofs, null, 2)
    );
    console.log(`フロントエンドから受信したプルーフを保存: debug-proof-${timestamp}.json`);
    
    // プルーフの検証
    console.log('プルーフ検証開始...');
    let verificationResult = false;
    
    try {
      // プルーフデータの形式に応じた検証
      if (Array.isArray(normalizedProofs)) {
        // 配列の場合は各要素を検証
        console.log('配列形式のプルーフを検証します');
        for (const proof of normalizedProofs) {
          // Reclaimの公式verifyProof関数を使用して検証
          const result = await verifyProof(proof);
          if (result) {
            verificationResult = true;
            console.log('プルーフ検証成功:', result);
            break; // 一つでも有効なプルーフがあれば成功と判断
          }
        }
      } else {
        // オブジェクト形式の場合は直接検証
        console.log('オブジェクト形式のプルーフを検証します');
        verificationResult = await verifyProof(normalizedProofs);
        console.log('プルーフ検証結果:', verificationResult);
      }
    } catch (verifyError) {
      console.error('検証中にエラーが発生:', verifyError);
      console.error('エラースタック:', verifyError.stack);
      verificationResult = false;
    }
    
    if (!verificationResult) {
      console.log('プルーフ検証失敗');
      return res.status(400).json({ 
        error: 'プルーフの検証に失敗しました', 
        message: 'Web証明の検証処理でエラーが発生しました。正しい形式のWeb証明であることを確認してください。',
        verified: false 
      });
    }
    
    // 検証成功後のユーザーデータ抽出
    let userData = null;
    
    try {
      if (Array.isArray(normalizedProofs) && normalizedProofs.length > 0) {
        const proof = normalizedProofs[0];
        if (proof.publicData) {
          userData = {
            username: proof.publicData.username || 'N/A',
            creationYear: proof.publicData.creationYear || 'N/A',
            contributionsLastYear: proof.publicData.contributionsLastYear || 'N/A'
          };
        } else if (proof.parameters) {
          userData = {
            username: proof.parameters.username || 'N/A',
            creationYear: proof.parameters.creationYear || 'N/A',
            contributionsLastYear: proof.parameters.contributionsLastYear || 'N/A'
          };
        }
      } else if (!Array.isArray(normalizedProofs)) {
        if (normalizedProofs.publicData) {
          userData = {
            username: normalizedProofs.publicData.username || 'N/A',
            creationYear: normalizedProofs.publicData.creationYear || 'N/A',
            contributionsLastYear: normalizedProofs.publicData.contributionsLastYear || 'N/A'
          };
        } else if (normalizedProofs.parameters) {
          userData = {
            username: normalizedProofs.parameters.username || 'N/A',
            creationYear: normalizedProofs.parameters.creationYear || 'N/A',
            contributionsLastYear: normalizedProofs.parameters.contributionsLastYear || 'N/A'
          };
        }
      }
      
      // すべての方法でデータが取得できなかった場合のフォールバック
      if (!userData || (userData.username === 'N/A' && userData.creationYear === 'N/A')) {
        console.log('標準的な方法でのデータ抽出に失敗、代替方法を試みます');
        userData = { note: "プルーフは有効ですが、詳細データを抽出できませんでした" };
      }
    } catch (extractError) {
      console.error('ユーザーデータ抽出エラー:', extractError);
      userData = { 
        note: "プルーフは有効ですが、データ抽出中にエラーが発生しました" 
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
    console.error('エラースタック:', error.stack);
    console.error('===== エラー終了 =====');
    
    return res.status(500).json({ 
      error: 'プルーフの処理中にエラーが発生しました',
      message: error.message || '不明なエラーが発生しました',
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