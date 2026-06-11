import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
 Image,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { GoogleGenerativeAI } from '@google/generative-ai';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ================= API KEY =================
// Load API key from environment variables
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  console.warn('Warning: Google API Key not configured. Set GOOGLE_API_KEY environment variable.');
}

// ================= GEMINI =================
const genAI = new GoogleGenerativeAI(API_KEY);

const App = () => {
  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState('');
  const [savedDocs, setSavedDocs] = useState([]);

  // ================= LOAD SAVED DOCS =================
  useEffect(() => {
    loadSavedDocuments();
  }, []);

  const loadSavedDocuments = async () => {
    try {
      const data =
        JSON.parse(await AsyncStorage.getItem('documents')) || [];

      console.log('Loaded Documents:', data);

      setSavedDocs(data);
    } catch (error) {
      console.log('Load Error:', error);
    }
  };

  // ================= OCR FUNCTION =================
  const handleOCR = async (base64Data, mimeType) => {
    console.log('handleOCR called');

    if (!base64Data) {
      console.log('No base64 data received');
      Alert.alert('Error', 'No image data found.');
      return;
    }

    setLoading(true);
    setExtractedData('');

    try {
      console.log('Initializing Gemini Model...');

      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
      });

      console.log('Model Initialized');

      const prompt = `
Extract the following information from this document:

1. Document Number
2. Holder Name
3. Expiry Date

Return result in JSON format.
`;

      const imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: mimeType || 'image/jpeg',
        },
      };

      console.log('Sending request to Gemini...');

      const result = await model.generateContent([
        prompt,
        imagePart,
      ]);

      console.log('Gemini Response:', result);

      const response = await result.response;

      const text = response.text();

      console.log('Extracted Text:', text);

      setExtractedData(text);
    } catch (error) {
      console.log('OCR Error:', error);

      setExtractedData(
        `Error processing document:\n${error.message}`,
      );
    } finally {
      setLoading(false);
    }
  };

  // ================= SAVE DOCUMENT =================
  const saveDocument = async () => {
    try {
      if (!imageUri || !extractedData) {
        Alert.alert('Error', 'No document data to save');
        return;
      }

      const newDocument = {
        id: Date.now().toString(),
        image: imageUri,
        details: extractedData,
        createdAt: new Date().toLocaleString(),
      };

      console.log('Saving Document:', newDocument);

      const existingData =
        JSON.parse(await AsyncStorage.getItem('documents')) || [];

      const updatedData = [newDocument, ...existingData];

      await AsyncStorage.setItem(
        'documents',
        JSON.stringify(updatedData),
      );

      setSavedDocs(updatedData);

      Alert.alert('Success', 'Document Saved');

      console.log('Document Saved Successfully');
    } catch (error) {
      console.log('Save Error:', error);

      Alert.alert('Error', 'Failed to save document');
    }
  };

  // ================= DELETE DOCUMENT =================
  const deleteDocument = async (id) => {
    try {
      const filteredDocs = savedDocs.filter(
        item => item.id !== id,
      );

      await AsyncStorage.setItem(
        'documents',
        JSON.stringify(filteredDocs),
      );

      setSavedDocs(filteredDocs);

      Alert.alert('Deleted', 'Document Removed');
    } catch (error) {
      console.log('Delete Error:', error);
    }
  };

  // ================= IMAGE PICKER =================
  const pickImage = async (useCamera = false) => {
    const options = {
      mediaType: 'photo',
      includeBase64: true,
      quality: 1,
    };

    const callback = response => {
      console.log('Image Picker Response:', response);

      if (response.didCancel) {
        console.log('User cancelled image picker');
        return;
      }

      if (response.errorCode) {
        console.log('Image Picker Error:', response.errorMessage);

        Alert.alert(
          'Error',
          response.errorMessage || 'Something went wrong.',
        );

        return;
      }

      if (!response.assets || response.assets.length === 0) {
        Alert.alert('Error', 'No image selected.');
        return;
      }

      const asset = response.assets[0];

      console.log('Selected Asset:', asset);

      setImageUri(asset.uri);

      handleOCR(asset.base64, asset.type);
    };

    if (useCamera) {
      launchCamera(options, callback);
    } else {
      launchImageLibrary(options, callback);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>OCR Scanner</Text>
      </View>

      {/* CONTENT */}
      <ScrollView contentContainerStyle={styles.content}>
        {/* BUTTONS */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => pickImage(true)}>
            <Text style={styles.buttonText}>Camera</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => pickImage(false)}>
            <Text style={styles.buttonText}>Gallery</Text>
          </TouchableOpacity>
        </View>

        {/* IMAGE PREVIEW */}
        {imageUri && (
          <Image
            source={{ uri: imageUri }}
            style={styles.preview}
          />
        )}

        {/* LOADER */}
        {loading && (
          <ActivityIndicator
            size="large"
            color="#007AFF"
            style={{ marginTop: 20 }}
          />
        )}

        {/* OCR RESULT */}
        {!loading && extractedData ? (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>
              Extracted Details
            </Text>

            <Text style={styles.resultText}>
              {extractedData}
            </Text>

            {/* SAVE BUTTON */}
            <TouchableOpacity
              style={[styles.button, { marginTop: 15 }]}
              onPress={saveDocument}>
              <Text style={styles.buttonText}>
                Save Document
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* SAVED DOCUMENTS */}
        {savedDocs.length > 0 && (
          <View style={{ width: '100%', marginTop: 25 }}>
            <Text style={styles.savedTitle}>
              Saved Documents
            </Text>

            {savedDocs.map(item => (
              <View
                key={item.id}
                style={styles.savedCard}>
                <Image
                  source={{ uri: item.image }}
                  style={styles.savedImage}
                />

                <Text style={styles.resultText}>
                  {item.details}
                </Text>

                <Text style={styles.dateText}>
                  {item.createdAt}
                </Text>

                {/* DELETE BUTTON */}
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteDocument(item.id)}>
                  <Text style={styles.buttonText}>
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// ================= STYLES =================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',
  },

  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },

  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
  },

  content: {
    padding: 20,
    alignItems: 'center',
    paddingBottom: 100,
  },

  buttonRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },

  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
    marginHorizontal: 5,
  },

  secondaryButton: {
    backgroundColor: '#5856D6',
  },

  deleteButton: {
    backgroundColor: 'red',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },

  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },

  preview: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    marginBottom: 20,
    resizeMode: 'contain',
    backgroundColor: '#ddd',
  },

  resultContainer: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    elevation: 3,
    marginTop: 20,
  },

  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 10,
  },

  resultText: {
    color: '#333',
    lineHeight: 22,
    fontSize: 14,
  },

  savedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#222',
  },

  savedCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 3,
  },

  savedImage: {
    width: '100%',
    height: 220,
    borderRadius: 10,
    resizeMode: 'cover',
    marginBottom: 12,
  },

  dateText: {
    marginTop: 10,
    color: 'gray',
    fontSize: 12,
  },
});
export default App;
